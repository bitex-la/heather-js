import axios from 'axios'
import _ from 'lodash'

const minimum_data = { data: {} }

export default class Client {
  constructor(base_url){
    this.base_url = base_url
  }

  build_request({ method = '', data = minimum_data, meta = {} } = {}){
    const headers = this.build_headers()

    return {
      base_url: this.base_url,
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

  build_data({ resource, type }){
    let result = minimum_data

    result.data.type = type || resource.constructor.name.toLowerCase()

    if (resource) {
      result.data.id = resource.id
      result.data.attributes = {}

      _.forOwn(resource, (value, property) => {
        if(property !== 'id') result.data.attributes[property] = value
      })
    }
    return result
  }

  build_request_find({type, id = 0, meta} = {}){
    const resource = { id }
    const data = this.build_data({ resource, type })
    return this.build_request({method: 'GET', data, meta})
  }

  build_request_find_all(){
    return this.build_request({method: 'GET'})
  }

  build_request_update({ resource, type }){
    const data = this.build_data({resource, type})
    return this.build_request({method: 'PATCH', data})
  }

  build_request_create(){
    return this.build_request({method: 'POST'})
  }

  build_request_delete(){
    return this.build_request({method: 'DELETE'})
  }

  // This was split into the method and a build method to be able to test the
  // requests without mocking the network
  find(params){
    return axios(this.build_request_find(params))
  }

  find_all(params){
    return axios(this.build_request_find_all(params))
  }

  update(params){
    return axios(this.build_request_update(params))
  }

  create(params){
    return axios(this.build_request_create(params))
  }

  delete(params){
    return axios(this.build_request_delete(params))
  }

  deserialize(data, klass){
    let obj;
    if(klass) {
      obj = new klass()
    } else {
      obj = {type: data.type}
    }
    obj.id = data.id
    _.forEach(data.attributes, (value, key) => {
      obj[key] = value;
    })

    return obj
  }
}
