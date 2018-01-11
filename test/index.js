import { expect } from 'chai';
import client from '../src';

describe('jsonapi-client', function(){
  it('should send the correct Content-Type header', () => {
    const request = client.build_request();
    expect(request.headers).to.have.property('Content-Type');
    expect(request.headers['Content-Type']).to.equal('application/vnd.api+json');
  })
})
