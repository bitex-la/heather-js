import axios from 'axios';
import _ from 'lodash';

const minimum_data = { data: {} };

export default class Client {
  constructor(baseURL){
    this.baseURL = baseURL;
  }

  build_request(method, data){
    const headers = this.build_headers();
    data = data || minimum_data

    return {
      baseURL: this.baseURL,
      method,
      headers,
      data
    }
  }

  build_headers(){
    return {
      'Content-Type': 'application/vnd.api+json'
    }
  }

  build_data(resource, type){
    let result = minimum_data;

    if (type) result.data.type = type;

    if (resource) {
      result.data.id = resource.id;
      result.data.attributes = {};

      _.forOwn(resource, (value, property) => {
        if(property !== 'id') result.data.attributes[property] = value;
      });
    }
    return result;
  }

  find(){
    return this.build_request('GET');
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
