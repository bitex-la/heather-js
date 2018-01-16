import axios from 'axios'
import _ from 'lodash'

const minimum_data = { data: {} }

export default class Client {
  constructor(base_url){
    this.base_url = base_url
  }

  build_request(method, data, meta){
    const headers = this.build_headers()

    data = data || minimum_data

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

  build_data(resource, type){
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

  build_request_find(type, id, meta){
    const data = this.build_data({ id }, type)
    return this.build_request('GET', data, meta);
  }

  build_request_find_all(){
    return this.build_request('GET')
  }

  build_request_update({ resource, type }){
    const data = this.build_data(resource, type)
    return this.build_request('PATCH', data)
  }

  build_request_create(){
    return this.build_request('POST')
  }

  build_request_delete(){
    return this.build_request('DELETE')
  }

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
}
