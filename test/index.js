import chai, { expect } from 'chai'
import spies from 'chai-spies'
chai.use(spies)
const sandbox = chai.spy.sandbox()

import JsonApiClient from '../src'

class Dog {
  constructor(id, age){
    this.id = id
    this.age = age
  }
}

class Cat {
  constructor(id, age, friend){
    this.id = id
    this.age = age
    this.friend = friend
  }
}

describe('jsonapi-client', function(){
  let client
  let puppy, puppy2, kitten
  let dog_response, dog_response_without_type, dogs_response
  let cat_response, cat_response_with_links, cats_response_with_links

  beforeEach(() => {
    client = new JsonApiClient('http://anyapi.com')

    puppy = new Dog(1, 2)
    puppy2 = new Dog(2, 3)
    dog_response = {
      type: 'dog',
      id: 1,
      attributes: {
        age: 2
      }
    }
    dog_response_without_type = {
      id: 1,
      attributes: {
        age: 2
      }
    }
    dogs_response = [
      {
        type: 'dog',
        id: 1,
        attributes: {
          age: 2
        }
      },
      {
        type: 'dog',
        id: 2,
        attributes: {
          age: 3
        }
      }
    ]
    kitten = new Cat(1, 2, puppy)
    cat_response = {
      type: 'cat',
      id: 1,
      attributes: {
        age: 2,
        color: 'white'
      }
    }
    cat_response_with_links = {
      type: 'cats',
      id: 2,
      attributes: {
        age: 2,
        color: 'white'
      },
      links: {
        self: 'http://anyapi.com/cat/2/'
      }
    }
    cats_response_with_links = {
      links: {
        next: 'http://anyapi.com/cat/next/'
      },
      data: [{
        type: 'cats',
        id: 2,
        attributes: {
          age: 2,
          color: 'white'
        }
      }]
    }
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('should send the correct Content-Type header', () => {
    const request = client.build_request()
    expect(request.headers).to.have.property('Content-Type')
    expect(request.headers['Content-Type']).to.equal('application/vnd.api+json')
  })

  it('should take the initial URL as request url', () => {
    const request = client.build_request()
    expect(request.url).to.equal('http://anyapi.com/')
  })

  it('should send a GET request on find', () => {
    const request = client.build_request_find()
    expect(request.method).to.equal('GET')
  })

  it('should send a GET request on find_all', () => {
    const request = client.build_request_find_all({type: 'dog'})
    expect(request.method).to.equal('GET')
  })

  it('should send a PATCH request on update', () => {
    const request = client.build_request_update({type: 'whatever'})
    expect(request.method).to.equal('PATCH')
  })

  it('should send a POST request on create', () => {
    const request = client.build_request_create({})
    expect(request.method).to.equal('POST')
  })

  it('should send a DELETE request on delete', () => {
    const request = client.build_request_delete({type: 'whatever'})
    expect(request.method).to.equal('DELETE')
  })

  it('should always send a data attribute', () => {
    const request = client.build_request()
    expect(request.data).to.have.property('data')
  })

  it('should parse an object into the data as a resource', () => {
    const request = client.build_request_update({resource: puppy, type: 'dogs'})

    expect(request.data.data).to.eql({
      type: 'dogs',
      id: 1,
      attributes: {
        age: 2
      }
    })
  })

  it('should infer the type if no explicit type is provided', () => {
    const puppy = new Dog(1, 2)

    const request = client.build_request_update({resource: puppy})

    expect(request.data.data).to.eql({
      type: 'dogs',
      id: 1,
      attributes: {
        age: 2
      }
    })
  })

  it('should allow meta data', () => {
    const request = client.build_request_find({type: 'dog', id: 1, meta: {meta_field: 'meta_value'}})

    expect(request.meta).to.eql({
      meta_field: 'meta_value'
    })
  })

  it('should parse an object with a given class', () => {
    const received_dog = client.deserialize(dog_response_without_type, Dog)

    expect(received_dog).to.eql(puppy)
  })

  it('should parse an object without class', () => {
    const received_dog = client.deserialize(dog_response)

    expect(received_dog).to.eql({
      type: 'dog',
      id: 1,
      age: 2
    })
  })

  it('should parse an array of objects with a given class', () => {
    const received_dogs = client.deserialize_array(dogs_response, Dog)

    expect(received_dogs).to.be.an('array').to.have.deep.members([puppy, puppy2])
  })

  it('should serialize only whitelisted attributes if specified', () => {
    const request = client.build_request_update({resource: kitten, attributes: ['age']})

    expect(request.data.data).to.eql({
      type: 'cats',
      id: 1,
      attributes: {
        age: 2
      }
    })
  })

  it('should deserialize only whitelisted attributes if specified', () => {
    const received_cat = client.deserialize(cat_response, Cat, {attributes: ['age']})

    expect(received_cat).to.eql(new Cat(1, 2))
  })

  it('should ask only for whitelisted attributes if specified', () => {
    const request = client.build_request_find({type: 'cat', id: 1, attributes: ['age', 'color']})

    expect(request.url).to.include('fields[cat]=age,color')
  })

  it('should ask only for whitelisted attributes if specified on find_all', () => {
    const request = client.build_request_find_all({type: 'cat', attributes: ['age', 'color']})

    expect(request.url).to.include('fields[cat]=age,color')
  })

  it('should write the type in the url', () => {
    const request = client.build_request_find_all({type: 'dog'})
    expect(request.url).to.equal('http://anyapi.com/dog/')
  })

  it('should write the id in the url', () => {
    const request = client.build_request_find({type: 'dog', id: 1})
    expect(request.url).to.equal('http://anyapi.com/dog/1/')
  })

  it('should write the id in the url for update', () => {
    const request = client.build_request_update({resource: puppy})
    expect(request.url).to.equal('http://anyapi.com/dogs/1/')
  })

  it('should write the id in the url for delete', () => {
    const request = client.build_request_delete({resource: puppy})
    expect(request.url).to.equal('http://anyapi.com/dogs/1/')
  })

  it('should not pluralize if it is specified', () => {
    client.pluralize = false
    const request = client.build_request_delete({resource: puppy})
    expect(request.url).to.equal('http://anyapi.com/dog/1/')
  })

  it('should deserialize inserting the links into the object', () => {
    const received_cat = client.deserialize(cat_response_with_links, Cat)

    expect(received_cat.links).to.eql({ self: 'http://anyapi.com/cat/2/' })
  })

  it('should call find on self link when refreshing', () => {
    const received_cat = client.deserialize(cat_response_with_links, Cat)

    sandbox.on(client, 'custom_request', ({url}) => 'Received URL = ' + url)

    const response = received_cat.refresh()

    expect(response).to.eql('Received URL = http://anyapi.com/cat/2/')
  })

  it('should specify the sorting in the url', () => {
    const sorting_object = [{ attribute: 'age', orientation: 'desc'}, { attribute: 'color'}]
    const request = client.build_request_find_all({type: 'cat', sort: sorting_object})

    expect(request.url).to.include('sort=-age,color')
  })

  it('should specify a filter parameter in the url without modifying it', () => {
    const request = client.build_request_find_all({type: 'cat', filter: 'age>2'})

    expect(request.url).to.include('filter=age>2')
  })

  it('should admit pagination in find_all', () => {
    const received_cat = client.deserialize_array(cats_response_with_links, Cat)

    sandbox.on(client, 'custom_request', ({url}) => 'Received URL = ' + url)

    const response = received_cat.next()

    expect(response).to.eql('Received URL = http://anyapi.com/cat/next/')
  })
})
