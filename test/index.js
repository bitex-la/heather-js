import { expect } from 'chai';
import JsonApiClient from '../src';

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
})
