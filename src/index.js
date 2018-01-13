import axios from 'axios';
import _ from 'lodash';

const minimum_data = { data: {} };

export default class Client {
  constructor(baseURL){
    this.baseURL = baseURL;
  }

  build_request(method, data, meta){
    const headers = this.build_headers();
    data = data || minimum_data

    return {
      baseURL: this.baseURL,
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
    let result = minimum_data;

    result.data.type = type || resource.constructor.name.toLowerCase();

    if (resource) {
      result.data.id = resource.id;
      result.data.attributes = {};

      _.forOwn(resource, (value, property) => {
        if(property !== 'id') result.data.attributes[property] = value;
      });
    }
    return result;
  }

  find(type, id, meta){
    const data = this.build_data({ id }, type)
    return this.build_request('GET', data, meta);
  }

  findAll(){
    return this.build_request('GET');
  }

  update(resource, type){
    const data = this.build_data(resource, type);
    return this.build_request('PATCH', data);
  }

  create(){
    return this.build_request('POST');
  }

  delete(){
    return this.build_request('DELETE');
  }
}
