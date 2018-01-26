import axios from 'axios'
import _ from 'lodash'
import { fromJS } from 'immutable'
import pluralize from 'pluralize'

const minimum_data = fromJS({ data: {} })

export default class Client {
  constructor(base_url, { pluralize = true } = {}){
    this.base_url = (base_url.slice(-1) === '/') ? base_url : base_url + '/'
    this.pluralize = pluralize
  }

  build_request({ method = '', data = minimum_data.toJS(), meta = {}, attributes } = {}){
    const headers = this.build_headers()

    const url = this.build_url(data, attributes)

    return {
      url,
      method,
      headers,
      data,
      meta
    }
  }

  build_headers(){
    return {
      'Content-Type': 'application/vnd.api+json'
    }
  }

  build_url({data = {}}, attributes){
    let url = this.base_url

    url += (data.type) ? data.type + '/' : ''
    url += (data.id) ? data.id + '/' : ''
    url += (attributes) ? '?fields[' + data.type + ']=' +attributes.join(',') : ''

    return url
  }

  build_data({ resource, type, attributes = [] }){
    let result = minimum_data.toJS()

    result.data.type = type || this.infer_type(resource)

    if (resource) {
      if (resource.id) {
        result.data.id = resource.id
      }
      result.data.attributes = {}

      _.forOwn(resource, (value, property) => {
        if (property !== 'id' && (_.isEmpty(attributes) || _.includes(attributes, property))) {
          result.data.attributes[property] = value
        }
      })
    }

    return result
  }

  infer_type(resource) {
    const resource_type = resource.constructor.name.toLowerCase()
    return (this.pluralize) ?
      pluralize(resource_type) :
      resource_type
  }

  build_request_find({ type, id = 0, meta, attributes } = {}){
    const resource = { id }
    const data = this.build_data({ resource, type })
    return this.build_request({ method: 'GET', data, meta, attributes })
  }

  build_request_find_all({ type, attributes }){
    const data = this.build_data({ type })
    return this.build_request({ method: 'GET', data, attributes })
  }

  build_request_update({ resource, type, attributes }){
    const data = this.build_data({ resource, type, attributes })
    return this.build_request({ method: 'PATCH', data })
  }

  build_request_create({ resource, type, attributes }){
    return this.build_request({ method: 'POST' })
  }

  build_request_delete({ resource, type }){
    const data = this.build_data({ resource, type })
    return this.build_request({ method: 'DELETE', data })
  }

  // These were split into the method and a build method to be able to test the
  // requests without mocking the network
  find(params){
    return new Promise((resolve, reject) => {
      axios(this.build_request_find(params)).then(
        response => resolve(this.deserialize(response.data))
      ).catch(
        error => reject(error)
      )
    })
  }

  find_all(params){
    return new Promise((resolve, reject) => {
      axios(this.build_request_find_all(params)).then(
        response => resolve(this.deserialize_array(response.data))
      ).catch(
        error => reject(error)
      )
    })
  }

  update(params){
    return new Promise((resolve, reject) => {
      axios(this.build_request_update(params)).then(
        response => resolve(this.deserialize(response.data))
      ).catch(
        error => reject(error)
      )
    })
  }

  create(params){
    return new Promise((resolve, reject) => {
      axios(this.build_request_create(params)).then(
        response => resolve(this.deserialize(response.data))
      ).catch(
        error => reject(error)
      )
    })
  }

  delete(params){
    return new Promise((resolve, reject) => {
      axios(this.build_request_delete(params)).then(
        response => resolve(this.deserialize(response.data))
      ).catch(
        error => reject(error)
      )
    })
  }

  //Allow requests not necessarily in JSON API.
  custom_request(request){
    return axios(request).catch(
      error => console.log(error)
    )
  }

  deserialize(data, klass, params = {}){
    let obj = (klass) ? new klass() : { type: data.type }

    obj.id = data.id

    _.forEach(data.attributes, (value, key) => {
      if(!params.attributes || _.includes(params.attributes, key)) {
        obj[key] = value
      }
    })

    if (data.links) {
      obj.links = data.links
      if (data.links.self) {
        obj.refresh = () => this.custom_request({ url: data.links.self })
      }
    }

    return obj
  }

  deserialize_array(data, klass){
    return _.map(data, elem => this.deserialize(elem, klass))
  }
}
