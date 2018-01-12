import { expect } from 'chai';
import JsonApiClient from '../src';

class Dog {
  constructor(id, age){
    this.id = id
    this.age = age
  }
}

describe('jsonapi-client', function(){
  it('should send the correct Content-Type header', () => {
    const client = new JsonApiClient();
    const request = client.build_request();
    expect(request.headers).to.have.property('Content-Type');
    expect(request.headers['Content-Type']).to.equal('application/vnd.api+json');
  })

  it('should take the initial URL as baseUrl', () => {
    const client = new JsonApiClient('http://anyapi.com');
    const request = client.build_request();
    expect(request.baseURL).to.equal('http://anyapi.com');
  })

  it('should send a GET request on find', () => {
    const client = new JsonApiClient('http://anyapi.com');
    const request = client.find();
    expect(request.method).to.equal('GET');
  })

  it('should send a GET request on findAll', () => {
    const client = new JsonApiClient('http://anyapi.com');
    const request = client.findAll();
    expect(request.method).to.equal('GET');
  })

  it('should send a PATCH request on update', () => {
    const client = new JsonApiClient('http://anyapi.com');
    const request = client.update();
    expect(request.method).to.equal('PATCH');
  })

  it('should send a POST request on create', () => {
    const client = new JsonApiClient('http://anyapi.com');
    const request = client.create();
    expect(request.method).to.equal('POST');
  })

  it('should send a DELETE request on delete', () => {
    const client = new JsonApiClient('http://anyapi.com');
    const request = client.delete();
    expect(request.method).to.equal('DELETE');
  })

  it('should always send a data attribute', () => {
    const client = new JsonApiClient('http://anyapi.com');
    const request = client.build_request();
    expect(request.data).to.have.property('data');
  })

  it('should parse an object into the data as a resource', () => {
    const puppy = new Dog(1, 2);

    const client = new JsonApiClient('http://anyapi.com');
    const request = client.update(puppy, 'dog');

    expect(request.data.data).to.eql({
      type: 'dog',
      id: 1,
      attributes: {
        age: 2
      }
    });
  })
})
