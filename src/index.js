import axios from 'axios';

export default class Client {
  constructor(baseURL){
    this.baseURL = baseURL
  }

  build_request(method){
    const headers = this.build_headers()

    return {
      baseURL: this.baseURL,
      method,
      headers
    }
  }

  build_headers(){
    return {
      'Content-Type': 'application/vnd.api+json'
    }
  }

  find(){
    return this.build_request('GET');
  }

  findAll(){
    return this.build_request('GET');
  }

  update(){
    return this.build_request('PATCH');
  }

  create(){
    return this.build_request('POST');
  }

  delete(){
    return this.build_request('DELETE');
  }
}
