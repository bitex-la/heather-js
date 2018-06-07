import axios from 'axios'
import _ from 'lodash'
import { fromJS } from 'immutable'
import pluralize from 'pluralize'

const minimumData = fromJS({ data: {} })
const snakeToCamel = (s) => s.replace(/(\_\w)/g, (m) => m[1].toUpperCase())

export default class Client {
  constructor(baseUrl, { usePlural = true } = {}){
    this.baseUrl = (baseUrl.slice(-1) === '/') ? baseUrl : baseUrl + '/'
    this.usePlural = usePlural
    this.models = []
    this.headers = {'Content-Type': 'application/vnd.api+json'}
  }

  define(model){
    this.models.push(model)
  }

  buildRequest({ method = '', data = minimumData.toJS(), meta = {}, urlParams = {}} = {}){

    const url = this.buildUrl(data, urlParams)

    return {
      url,
      method,
      headers: this.headers,
      data,
      meta
    }
  }

  setHeader(key, value){
    this.headers[key] = value
  }

  buildUrl({ data = {} }, { attributes, sort, filter }){
    let url = this.baseUrl

    url += (data.type) ? data.type + '/' : ''
    url += (data.id) ? data.id + '/' : ''

    let suffixes = []

    if (attributes) {
      suffixes.push('fields[' + data.type + ']=' + attributes.join(','))
    }

    if (sort) {
      const sortStrings = sort.map((sortingObject) =>
        (sortingObject.orientation && sortingObject.orientation.toLowerCase() === 'desc') ?
          '-' + sortingObject.attribute :
          sortingObject.attribute
      )
      suffixes.push('sort=' + sortStrings.join(','))
    }

    if (filter) {
      suffixes.push('filter=' + filter)
    }

    url += (!_.isEmpty(suffixes)) ? '?' + suffixes.join('&') : ''

    return url
  }

  buildData({ resource, type, attributes = [] }){
    let result = minimumData.toJS()

    result.data.type = type || this.inferType(resource)

    if (resource) {
      if (resource.id) {
        result.data.id = resource.id
      }
      result.data.attributes = {}

      _.forOwn(resource, (value, property) => {
        if (property !== 'id' && (_.isEmpty(attributes) || _.includes(attributes, property))) {
          if (_.includes(this.models, value.constructor)) {
            result.relationships = result.relationships || {}
            result.relationships[property] = this.buildData({ resource: value })
          } else {
            result.data.attributes[property] = value
          }
        }
      })
    }

    return result
  }

  inferType(resource) {
    const resourceType = resource.constructor.name.toLowerCase()
    return (this.usePlural) ?
      pluralize(resourceType) :
      resourceType
  }

  buildRequestFind({ type, id = 0, meta, attributes, sort, filter } = {}){
    const resource = { id }
    const data = this.buildData({ resource, type })
    const urlParams = { attributes, sort, filter }
    return this.buildRequest({ method: 'GET', data, meta, urlParams })
  }

  buildRequestFindAll({ type, attributes, sort, filter }){
    const data = this.buildData({ type })
    const urlParams = { attributes, sort, filter }
    return this.buildRequest({ method: 'GET', data, urlParams })
  }

  buildRequestUpdate({ resource, type, attributes }){
    const data = this.buildData({ resource, type, attributes })
    return this.buildRequest({ method: 'PATCH', data })
  }

  buildRequestCreate({ resource, type, attributes }){
    const data = this.buildData({ resource, type, attributes })
    return this.buildRequest({ method: 'POST', data })
  }

  buildRequestDelete({ resource, type }){
    const data = this.buildData({ resource, type })
    return this.buildRequest({ method: 'DELETE', data })
  }

  // These were split into the method and a build method to be able to test the
  // requests without mocking the network
  find(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestFind(params)).then(
        response => resolve(this.deserialize(response.data.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  findAll(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestFindAll(params)).then(
        response => resolve(this.deserializeArray(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  update(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestUpdate(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  create(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestCreate(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  delete(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestDelete(params)).then(
        response => resolve(response.data)
      ).catch(
        error => reject(error)
      )
    })
  }

  //Allow requests not necessarily in JSON API.
  customRequest(request){
    return axios(request)
  }

  deserialize(response, params = {}){
    let obj
    try {
      const className = _.capitalize(pluralize.singular(snakeToCamel(response.type)))
      const klass = this.models.find((model) => model.name === className)

      obj = new klass()
    } catch(e) {
      obj = { type: response.type }
    }

    obj.id = response.id

    _.forEach(response.attributes, (value, key) => {
      if(!params.attributes || _.includes(params.attributes, key)) {
        obj[key] = value
      }
    })

    if (response.links) {
      obj.links = _.omit(response.links, 'first', 'last', 'prev', 'next')
      if (response.links.self) {
        obj.refresh = () => this.customRequest({ url: response.links.self })
      }
    }

    _.forEach(response.relationships, (value, key) => {
      if (_.has(obj, key)) {
        obj[key] = (_.isArray(obj[key])) ?
          _.map(value.data, elem => this.deserialize(elem))
          : this.deserialize(value.data)
      }
    })

    return obj
  }

  deserializeArray(data, klass){
    const response = _.map(data, elem => this.deserialize(elem, klass))

    const paginationLinks = _.pick(data.links, 'first', 'last', 'prev', 'next')
    _.forOwn(paginationLinks, (value, key) => {
      response[key] = () => this.customRequest({ url: value })
    })

    return response
  }
}
