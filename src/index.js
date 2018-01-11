import axios from 'axios';

export default class Client {
  constructor(baseURL){
    this.baseURL = baseURL
  }

  build_request(){
    const headers = this.build_headers()

    return {
      baseURL: this.baseURL,
      headers
    }
  }

  build_headers(){
    return {
      'Content-Type': 'application/vnd.api+json'
    }
  }
}
