import _ from 'lodash'
import { fromJS } from 'immutable'
import pluralize from 'pluralize'

const minimumData = fromJS({ data: {} })

export default class Client {
  constructor(baseUrl, { usePlural = true, useSnakeCase = true } = {}, axios){
    this.baseUrl = (baseUrl.slice(-1) === '/') ? baseUrl : baseUrl + '/'
    this.usePlural = usePlural
    this.useSnakeCase = useSnakeCase
    this.models = []
    this.headers = {'Content-Type': 'application/vnd.api+json'}
    this.axios = axios
  }

  define(model){
    this.models.push(model)
  }

  buildRequest({
    method = '', data = minimumData.toJS(), meta = {}, urlParams = {}
  } = {}){

    const url = this.buildUrl(data, urlParams)
    if (method === 'GET') data = null

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

  buildUrl({ data = {} }, {
    attributes, sort, filter, customParams, path, action, resource_id
  }){
    let url = this.baseUrl
    resource_id = resource_id || data.id

    url += (path) ? path + '/' : ''
    url += (resource_id) ? resource_id + '/' : ''
    url += (action) ? action + '/' : ''

    let suffixes = []

    if (attributes) {
      suffixes.push(`fields[${data.type}]=` + attributes.join(','))
    }

    if (sort) {
      const sortStrings = sort.map((sortingObject) =>
        (
          sortingObject.orientation && 
          sortingObject.orientation.toLowerCase() === 'desc'
        ) ?
          '-' + sortingObject.attribute :
          sortingObject.attribute
      )
      suffixes.push('sort=' + sortStrings.join(','))
    }

    if (filter) {
      if (typeof filter === 'object'){
        _.forEach(filter, (value, key) => {
          suffixes.push(`filter[${key}]=${value}`)
        })
      } else {
        suffixes.push(`filter=${filter}`)
      }
    }

    if (customParams) {
      _.forOwn(customParams, (value, key) => suffixes.push(key + '=' + value))
    }

    url += (!_.isEmpty(suffixes)) ? '?' + suffixes.join('&') : ''

    return url
  }

  buildData({ resource, type, attributes = [] }){
    let result = minimumData.toJS()

    result.data.type = _.isString(type) ? type : this.inferType(resource)

    if (resource) {
      if (resource.id) {
        result.data.id = resource.id.toString() // Msut be a string
      }
      result.data.attributes = {}

      _.forOwn(resource, (value, property) => {
        if (
          property !== 'id' && 
          (_.isEmpty(attributes) || _.includes(attributes, property))
        ) {
          if (value && _.includes(this.models, value.constructor)) {
            result.data.relationships = result.data.relationships || {}
            result.data.relationships[_.snakeCase(property)] = this.buildData({
              resource: value
            })
          } else {
            result.data.attributes[_.snakeCase(property)] = value
          }
        }
      })
    }

    return result
  }

  inferType(resource) {
    let resourceType = (resource) ? resource.constructor.name : ''
    resourceType = (this.usePlural) ? pluralize(resourceType) : resourceType
    resourceType = (this.useSnakeCase) ?
      _.snakeCase(resourceType) : _.toLower(resourceType)
    return resourceType
  }

  /**
   * Builds the url path for the requested resource / type
   *
   * @param resource - Instance object of a defined model. Its class may or may
   * not implement a custom path behaviour. If not, the class name in lowercase
   * should be taken.
   * @param type - This parameter is either a string or a class. If it's a 
   * string that string should be taken as path, but if it's a class we should
   * take care of possible custom path building like the explained for resource.
   * @param extra - Object with custom parameters to send into the custom path
   * build method. Often an id that refers to the container of this model.
   */
  buildPath({ resource, type, extra}) {
    if (_.isString(type)) return type
    if (resource && _.isFunction(resource.constructor.path)) {
      return resource.constructor.path(extra)
    }
    if (!type) return this.inferType(resource)
    if (_.isFunction(type.path)) return type.path(extra)
    if (this.models.includes(type)) return this.inferType(new type())
    return ''
  }

  buildRequestFind({
    type, id = 0, meta, attributes, customParams, ...extra
  } = {}){
    const resource = { id }
    const data = this.buildData({ resource, type })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { attributes, customParams, path }
    return this.buildRequest({ method: 'GET', data, meta, urlParams })
  }

  buildRequestFindAll({
    type, attributes, sort, filter, customParams, ...extra
  }){
    const data = this.buildData({ type })
    const path = this.buildPath({ type, extra })
    const urlParams = { attributes, sort, filter, customParams, path }
    return this.buildRequest({ method: 'GET', data, urlParams })
  }

  buildRequestUpdate({ resource, type, attributes, ...extra }){
    const data = this.buildData({ resource, type, attributes })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { attributes, path }
    return this.buildRequest({ method: 'PATCH', data, urlParams })
  }

  buildRequestCreate({ resource, type, attributes, ...extra }){
    const data = this.buildData({ resource, type, attributes })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { attributes, path }
    return this.buildRequest({ method: 'POST', data, urlParams })
  }

  buildRequestDelete({ resource, type, ...extra }){
    const data = this.buildData({ resource, type })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { path }
    return this.buildRequest({ method: 'DELETE', data, urlParams })
  }

  buildRequestCustomAction({
    resource, type, action, filter, method = 'POST', ...extra
  }){
    const data = (_.isArray(resource))
      ? resource.map(
        (res) => this.buildData({ resource: res, type })
      )
      : this.buildData({ resource, type })
    const path = this.buildPath({ resource, type, extra })
    const resource_id = (resource) ? resource.id : null
    const urlParams = { path, action, resource_id, filter }
    return this.buildRequest({ method, data, urlParams, resource_id })
  }

  // These were split into the method and a build method to be able to test the
  // requests without mocking the network
  find(params){
    return new Promise((resolve, reject) => {
      this.axios(this.buildRequestFind(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  findAll(params){
    return new Promise((resolve, reject) => {
      this.axios(this.buildRequestFindAll(params)).then(
        response => resolve(this.deserializeArray(
          response.data, params.attributes
        ))
      ).catch(
        error => reject(error)
      )
    })
  }

  update(params){
    return new Promise((resolve, reject) => {
      this.axios(this.buildRequestUpdate(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  create(params){
    return new Promise((resolve, reject) => {
      this.axios(this.buildRequestCreate(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  delete(params){
    return new Promise((resolve, reject) => {
      this.axios(this.buildRequestDelete(params)).then(
        response => resolve(response.data)
      ).catch(
        error => reject(error)
      )
    })
  }

  customAction(params){
    return new Promise((resolve, reject) => {
      this.axios(this.buildRequestCustomAction(params)).then(
        response => resolve(response.data)
      ).catch(
        error => reject(error)
      )
    })
  }

  //Allow requests not necessarily in JSON API.
  customRequest(request){
    return this.axios(request)
  }

  deserialize({ data, included = [] }, params = {}){
    let obj
    let { links = {}, relationships = {}} = data
    try {
      const className = _.upperFirst(pluralize.singular(_.camelCase(data.type)))
      const klass = this.models.find(
        (model) => model.name === className || model.type === data.type
      )

      obj = new klass()
    } catch(e) {
      obj = { type: data.type }
    }

    obj.id = data.id

    _.forEach(data.attributes, (value, key) => {
      if(!params.attributes || _.includes(params.attributes, key)) {
        obj[_.camelCase(key)] = value
      }
    })

    if (!_.isEmpty(links)) {
      obj.links = _.omit(links, 'first', 'last', 'prev', 'next')
      if (links.self) {
        obj.refresh = () => this.customRequest({ url: links.self })
      }
    }

    _.forEach(relationships, (value, key) => {
      if (_.has(obj, key)) {
        obj[_.camelCase(key)] = (_.isArray(obj[key])) ?
          _.map(
            value.data,
            elem => this.deserializeRelationship(elem, included)
          )
          : this.deserializeRelationship(value.data, included)
      }
    })

    return obj
  }

  deserializeRelationship(elem, included = []){
    const includedElem = _.find(
      included,
      (e) => e.type == elem.type && e.id == elem.id
    )
    if(includedElem){
      elem.attributes = includedElem.attributes
    }
    return this.deserialize({data: elem})
  }

  deserializeArray({ data, links = [], included = [] }, klass){
    const response = (_.isArray(data))
      ? _.map(data, elem => this.deserialize({data: elem, included}, klass))
      : this.deserialize({data, included}, klass)

    const paginationLinks = _.pick(links, 'first', 'last', 'prev', 'next')
    _.forOwn(paginationLinks, (value, key) => {
      response[key] = () => this.customRequest({ url: value })
    })

    return response
  }
}
