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

class Owner{
  constructor(){
    this.name = null
  }

  static path({dog_id}){
    return `dogs/${dog_id}/owner`
  }
}

describe('jsonapi-client', function(){
  let client
  let puppy, puppy2, kitten
  let dogResponse, dogsResponse
  let catResponse, catResponseWithLinks, catsResponseWithLinks, catResponseWithRelationships
  let horseResponse

  beforeEach(() => {
    client = new JsonApiClient('http://anyapi.com')
    client.define(Dog)
    client.define(Cat)

    puppy = new Dog(1, 2)
    puppy2 = new Dog(2, 3)
    dogResponse = {
      data: {
        type: 'dog',
        id: 1,
        attributes: {
          age: 2
        }
      }
    }
    dogsResponse = {
      data: [
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
    }
    kitten = new Cat(1, 2, puppy)
    catResponse = {
      data: {
        type: 'cat',
        id: 1,
        attributes: {
          age: 2,
          color: 'white'
        }
      }
    }
    catResponseWithLinks = {
      data: {
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
    }
    catsResponseWithLinks = {
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
    catResponseWithRelationships = {
      data: {
        type: 'cats',
        id: 1,
        attributes: {
          age: 2
        },
        relationships: {
          friend: {
            data: {
              type: 'dogs',
              id: 1
            }
          }
        }
      },
      included: [{
        type: 'dogs',
        id: 1,
        attributes: {
          age: 2
        }
      }]
    }
    horseResponse = {
      data: {
        type: 'horse',
        id: 1,
        attributes: {
          age: 2
        }
      }
    }
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('should send the correct Content-Type header', () => {
    const request = client.buildRequest()
    expect(request.headers).to.have.property('Content-Type')
    expect(request.headers['Content-Type']).to.equal('application/vnd.api+json')
  })

  it('should take the initial URL as request url', () => {
    const request = client.buildRequest()
    expect(request.url).to.equal('http://anyapi.com/')
  })

  it('should send a GET request on find', () => {
    const request = client.buildRequestFind()
    expect(request.method).to.equal('GET')
  })

  it('should send a GET request on findAll', () => {
    const request = client.buildRequestFindAll({type: 'dog'})
    expect(request.method).to.equal('GET')
  })

  it('should send a PATCH request on update', () => {
    const request = client.buildRequestUpdate({type: 'whatever'})
    expect(request.method).to.equal('PATCH')
  })

  it('should send a POST request on create', () => {
    const request = client.buildRequestCreate({ resource: puppy })
    expect(request.method).to.equal('POST')
  })

  it('should send a DELETE request on delete', () => {
    const request = client.buildRequestDelete({type: 'whatever'})
    expect(request.method).to.equal('DELETE')
  })

  it('should always send a data attribute', () => {
    const request = client.buildRequest()
    expect(request.data).to.have.property('data')
  })

  it('should parse an object into the data as a resource', () => {
    const request = client.buildRequestUpdate({resource: puppy, type: 'dogs'})

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

    const request = client.buildRequestUpdate({resource: puppy})

    expect(request.data.data).to.eql({
      type: 'dogs',
      id: 1,
      attributes: {
        age: 2
      }
    })
  })

  it('should allow meta data', () => {
    const request = client.buildRequestFind({type: 'dog', id: 1, meta: {metaField: 'metaValue'}})

    expect(request.meta).to.eql({
      metaField: 'metaValue'
    })
  })

  it('should parse an object with an existing class', () => {
    const receivedDog = client.deserialize(dogResponse)

    expect(receivedDog).to.eql(puppy)
  })

  it('should parse an object without class', () => {
    const receivedDog = client.deserialize(horseResponse)

    expect(receivedDog).to.eql({
      type: 'horse',
      id: 1,
      age: 2
    })
  })

  it('should parse an array of objects with an existing class', () => {
    const receivedDogs = client.deserializeArray(dogsResponse)

    expect(receivedDogs).to.be.an('array').to.have.deep.members([puppy, puppy2])
  })

  it('should serialize only whitelisted attributes if specified', () => {
    const request = client.buildRequestUpdate({resource: kitten, attributes: ['age']})

    expect(request.data.data).to.eql({
      type: 'cats',
      id: 1,
      attributes: {
        age: 2
      }
    })
  })

  it('should deserialize only whitelisted attributes if specified', () => {
    const receivedCat = client.deserialize(catResponse, {attributes: ['age']})

    expect(receivedCat).to.eql(new Cat(1, 2))
  })

  it('should ask only for whitelisted attributes if specified', () => {
    const request = client.buildRequestFind({type: 'cat', id: 1, attributes: ['age', 'color']})

    expect(request.url).to.include('fields[cat]=age,color')
  })

  it('should ask only for whitelisted attributes if specified on findAll', () => {
    const request = client.buildRequestFindAll({type: 'cat', attributes: ['age', 'color']})

    expect(request.url).to.include('fields[cat]=age,color')
  })

  it('should write the type in the url', () => {
    const request = client.buildRequestFindAll({type: 'dog'})
    expect(request.url).to.equal('http://anyapi.com/dog/')
  })

  it('should write the id in the url', () => {
    const request = client.buildRequestFind({type: 'dog', id: 1})
    expect(request.url).to.equal('http://anyapi.com/dog/1/')
  })

  it('should write the id in the url for update', () => {
    const request = client.buildRequestUpdate({resource: puppy})
    expect(request.url).to.equal('http://anyapi.com/dogs/1/')
  })

  it('should write the id in the url for delete', () => {
    const request = client.buildRequestDelete({resource: puppy})
    expect(request.url).to.equal('http://anyapi.com/dogs/1/')
  })

  it('should not pluralize if it is specified', () => {
    client.usePlural = false
    const request = client.buildRequestDelete({resource: puppy})
    expect(request.url).to.equal('http://anyapi.com/dog/1/')
  })

  it('should deserialize inserting the links into the object', () => {
    const receivedCat = client.deserialize(catResponseWithLinks)

    expect(receivedCat.links).to.eql({ self: 'http://anyapi.com/cat/2/' })
  })

  it('should call find on self link when refreshing', () => {
    const receivedCat = client.deserialize(catResponseWithLinks)

    sandbox.on(client, 'customRequest', ({url}) => 'Received URL = ' + url)

    const response = receivedCat.refresh()

    expect(response).to.eql('Received URL = http://anyapi.com/cat/2/')
  })

  it('should specify the sorting in the url', () => {
    const sortingObject = [{ attribute: 'age', orientation: 'desc'}, { attribute: 'color'}]
    const request = client.buildRequestFindAll({type: 'cat', sort: sortingObject})

    expect(request.url).to.include('sort=-age,color')
  })

  it('should specify a filter parameter in the url without modifying it', () => {
    const request = client.buildRequestFindAll({type: 'cat', filter: 'age>2'})

    expect(request.url).to.include('filter=age>2')
  })

  it('should specify a custom parameters in the url', () => {
    const request = client.buildRequestFind({type: 'cat', customParams: {scope: 'this_scope'}})

    expect(request.url).to.include('scope=this_scope')
  })

  it('should request correctly to a class with custom path', () => {
    const request = client.buildRequestFind({type: Owner, id:'1', dog_id: '2'})

    expect(request.url).to.equal('http://anyapi.com/dogs/2/owner/1/')
  })

  it('should admit pagination in findAll', () => {
    const receivedCat = client.deserializeArray(catsResponseWithLinks)

    sandbox.on(client, 'customRequest', ({url}) => 'Received URL = ' + url)

    const response = receivedCat.next()

    expect(response).to.eql('Received URL = http://anyapi.com/cat/next/')
  })

  it('should serialize relationships on update', () => {
    const request = client.buildRequestUpdate({resource: kitten})

    expect(request.data.relationships).to.eql({
      friend: {
        data: {
          type: 'dogs',
          id: 1,
          attributes: {
            age: 2
          }
        }
      }
    })
  })

  it('should serialize relationships on create', () => {
    const request = client.buildRequestCreate({resource: kitten})

    expect(request.data.relationships).to.eql({
      friend: {
        data: {
          type: 'dogs',
          id: 1,
          attributes: {
            age: 2
          }
        }
      }
    })
  })

  it('should deserialize relationships on find', () => {
    const receivedCat = client.deserialize(catResponseWithRelationships)

    expect(receivedCat.friend).to.eql(puppy)
  })

  it('should allow custom header', () => {
    client.setHeader('Authorization', 'mytoken')
    const request = client.buildRequest()
    expect(request.headers).to.have.property('Authorization')
    expect(request.headers['Authorization']).to.equal('mytoken')
  })

  it('should allow custom action for collections', () => {
    const request = client.buildRequestCustomAction({type: 'dogs', action: 'walk', resource: [puppy, puppy2]})
    expect(request.url).to.equal('http://anyapi.com/dogs/walk/')
    expect(request.method).to.equal('POST')
    expect(request.data).to.eql([
      {
        data: {
          type: 'dogs',
          id: 1,
          attributes: {
            age: 2
          }
        }
      },
      {
        data: {
          type: 'dogs',
          id: 2,
          attributes: {
            age: 3
          }
        }
      }
    ])
  })

  it('should allow custom action for individuals', () => {
    const request = client.buildRequestCustomAction({resource: puppy, action: 'eat', method: 'PATCH'})
    expect(request.url).to.equal('http://anyapi.com/dogs/1/eat/')
    expect(request.method).to.equal('PATCH')
    expect(request.data.data).to.eql({
      type: 'dogs',
      id: 1,
      attributes: {
        age: 2
      }
    })
  })
})
