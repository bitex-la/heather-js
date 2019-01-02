import axios from 'axios'
import _ from 'lodash'
import { fromJS } from 'immutable'
import pluralize from 'pluralize'

const minimumData = fromJS({ data: {} })

export default class Client {
  /**
   * Create the Client.
   * @param {string} baseUrl 
   * @param {object} [config] - client's configuration object
   * @param {boolean} [config.usePlural] - use plurals for models paths
   * @param {boolean} [config.useSnakeCase] - use snake case for models paths
   */
  constructor(baseUrl, { usePlural = true, useSnakeCase = true } = {}){
    this.baseUrl = (baseUrl.slice(-1) === '/') ? baseUrl : baseUrl + '/'
    this.usePlural = usePlural
    this.useSnakeCase = useSnakeCase
    this.models = []
    this.headers = {'Content-Type': 'application/vnd.api+json'}
  }

  /**
   * Define models to be understood by the client.
   * @param {class} model 
   */
  define(model){
    this.models.push(model)
  }

  /**
   * @private
   * Build axios request based on method, data, and params.
   * @param request
   * @param {string} request.method - HTTP method to execute.
   * @param {object} request.data - Payload.
   * @param {object} [request.meta] - Meta field of JSON:API.
   * @param {object} [request.urlParams] - Params to be included in the URL.
   */
  buildRequest({
    method = '', data = minimumData.toJS(), meta = {}, urlParams = {}
  } = {}){

    const url = this.buildUrl(data, urlParams)
    if (method === 'GET') data = null

    return {
      url,
      method,
      headers: this.headers,
      data,
      meta
    }
  }

  /**
   * Set header to be used by the client in every request.
   * @param {string} key 
   * @param {string} value 
   */
  setHeader(key, value){
    this.headers[key] = value
  }

  /**
   * @private
   * Build the URL for the resource and action specified.
   * @param {object} [resource]
   * @param {object} [resource.data]
   * @param {object} [requestConfig]
   * @param {string[]} [requestConfig.attributes]
   * @param {object[]} [requestConfig.sort] - Each object should have an 
   * 'attribute' field and an 'orientation' field (or none for 'ASC').
   * @param {string|object} [requestConfig.filter] - Raw filter or key-value
   * filter respectively.
   * @param {object} [requestConfig.customParams] - Key-value pairs to be 
   * included in the URL.
   * @param 
   */
  buildUrl({ data = {} }, {
    attributes, sort, filter, customParams, path, action, resource_id
  }){
    let url = this.baseUrl
    resource_id = resource_id || data.id

    url += (path) ? path + '/' : ''
    url += (resource_id) ? resource_id + '/' : ''
    url += (action) ? action + '/' : ''

    let suffixes = []

    if (attributes) {
      suffixes.push(`fields[${data.type}]=` + attributes.join(','))
    }

    if (sort) {
      const sortStrings = sort.map((sortingObject) =>
        (
          sortingObject.orientation && 
          sortingObject.orientation.toLowerCase() === 'desc'
        ) ?
          '-' + sortingObject.attribute :
          sortingObject.attribute
      )
      suffixes.push('sort=' + sortStrings.join(','))
    }

    if (filter) {
      if (typeof filter === 'object'){
        _.forEach(filter, (value, key) => {
          suffixes.push(`filter[${key}]=${value}`)
        })
      } else {
        suffixes.push(`filter=${filter}`)
      }
    }

    if (customParams) {
      _.forOwn(customParams, (value, key) => suffixes.push(key + '=' + value))
    }

    url += (!_.isEmpty(suffixes)) ? '?' + suffixes.join('&') : ''

    return url
  }

  /**
   * @private
   * Build the payload to be sent based on the resource provided
   * @param {object} data
   * @param {object} [data.resource] - Resource to build the data from
   * @param {string} [data.type]
   * @param {string[]} [data.attributes]
   */
  buildData({ resource, type, attributes = [] }){
    let result = minimumData.toJS()

    result.data.type = _.isString(type) ? type : this.inferType(resource)

    if (resource) {
      if (resource.id) {
        result.data.id = resource.id
      }
      result.data.attributes = {}

      _.forOwn(resource, (value, property) => {
        if (
          property !== 'id' && 
          (_.isEmpty(attributes) || _.includes(attributes, property))
        ) {
          if (value && _.includes(this.models, value.constructor)) {
            result.data.relationships = result.data.relationships || {}
            result.data.relationships[property] = this.buildData({
              resource: value
            })
          } else {
            result.data.attributes[property] = value
          }
        }
      })
    }

    return result
  }

  /**
   * @private
   * Infers the type of an object (based on its prototype)
   * @param {object} resource 
   */
  inferType(resource) {
    let resourceType = (resource) ? resource.constructor.name : ''
    resourceType = (this.usePlural) ? pluralize(resourceType) : resourceType
    resourceType = (this.useSnakeCase) ?
      _.snakeCase(resourceType) : _.toLower(resourceType)
    return resourceType
  }

  /**
   * Builds the url path for the requested resource / type
   * @param {object} resource - Instance object of a defined model. Its class
   * may or may not implement a custom path behaviour. If not, the class name in
   * lowercase should be taken.
   * @param {string|class} type - If it's a string that string should be taken
   * as path, but if it's a class we should take care of possible custom path
   * building like the explained for resource.
   * @param {object} extra - Object with custom parameters to send into the
   * custom path build method. Often an id that refers to the container of this
   * model.
   */
  buildPath({ resource, type, extra}) {
    if (_.isString(type)) return type
    if (resource && _.isFunction(resource.constructor.path)) {
      return resource.constructor.path(extra)
    }
    if (!type) return this.inferType(resource)
    if (_.isFunction(type.path)) return type.path(extra)
    if (this.models.includes(type)) return this.inferType(new type())
    return ''
  }

  /**
   * @private
   * Build axios request for a find request.
   * @param {object} requestConfig - Check find method to get a full description
   * about the arguments.
   */
  buildRequestFind({
    type, id = 0, meta, attributes, customParams, ...extra
  } = {}){
    const resource = { id }
    const data = this.buildData({ resource, type })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { attributes, customParams, path }
    return this.buildRequest({ method: 'GET', data, meta, urlParams })
  }

  /**
   * @private
   * Build axios request for a findAll request.
   * @param {object} requestConfig - Check findAll method to get a full
   * description about the arguments.
   */
  buildRequestFindAll({
    type, meta, attributes, sort, filter, customParams, ...extra
  }){
    const data = this.buildData({ type })
    const path = this.buildPath({ type, extra })
    const urlParams = { attributes, sort, filter, customParams, path }
    return this.buildRequest({ method: 'GET', data, meta, urlParams })
  }

  /**
   * @private
   * Build axios request for an update request.
   * @param {object} requestConfig - Check update method to get a full
   * description about the arguments.
   */
  buildRequestUpdate({ resource, type, attributes, ...extra }){
    const data = this.buildData({ resource, type, attributes })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { attributes, path }
    return this.buildRequest({ method: 'PATCH', data, urlParams })
  }

  /**
   * @private
   * Build axios request for a create request.
   * @param {object} requestConfig - Check create method to get a full
   * description about the arguments.
   */
  buildRequestCreate({ resource, type, attributes, ...extra }){
    const data = this.buildData({ resource, type, attributes })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { attributes, path }
    return this.buildRequest({ method: 'POST', data, urlParams })
  }

  /**
   * @private
   * Build axios request for a delete request.
   * @param {object} requestConfig - Check delete method to get a full
   * description about the arguments.
   */
  buildRequestDelete({ resource, type, ...extra }){
    const data = this.buildData({ resource, type })
    const path = this.buildPath({ resource, type, extra })
    const urlParams = { path }
    return this.buildRequest({ method: 'DELETE', data, urlParams })
  }

  /**
   * @private
   * Build axios request for a customAction request.
   * @param {object} requestConfig - Check customAction method to get a full
   * description about the arguments.
   */
  buildRequestCustomAction({
    resource, type, action, filter, method = 'POST', ...extra
  }){
    const data = (_.isArray(resource))
      ? resource.map(
        (res) => this.buildData({ resource: res, type })
      )
      : this.buildData({ resource, type })
    const path = this.buildPath({ resource, type, extra })
    const resource_id = (resource) ? resource.id : null
    const urlParams = { path, action, resource_id, filter }
    return this.buildRequest({ method, data, urlParams, resource_id })
  }

  // These were split into the method and a build method to be able to test the
  // requests without mocking the network

  /**
   * Request a single resource of a certain type.
   * @param {*} params 
   * @param {string|class} params.type
   * @param {number} params.id - ID of the resource to be fetched.
   * @param {object} [params.meta] - Meta field of JSON:API.
   * @param {string[]} [params.attributes] - Whitelist of attributes to
   * fetch.
   * @param {object} [params.customParams] - Key-value pairs to be 
   * included in the URL.
   * @param {object} [params.extra] - Object with custom parameters to
   * send into the custom path build method. Often an id that refers to the
   * container of this model.
   */
  find(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestFind(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  /**
   * Request all resources of a certain type.
   * @param {object} params
   * @param {string|class} params.type
   * @param {object} [params.meta] - Meta field of JSON:API.
   * @param {object[]} [params.sort] - Each object should have an 'attribute'
   * field and an 'orientation' field (or none for 'ASC').
   * @param {string|object} [params.filter] - Raw filter or key-value filter
   * respectively.
   * @param {string[]} [params.attributes] - Whitelist of attributes to fetch.
   * @param {object} [params.customParams] - Key-value pairs to be included in
   * the URL.
   * @param {object} [params.extra] - Object with custom parameters to send into
   * the custom path build method. Often an id that refers to the container of
   * this model.
   */
  findAll(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestFindAll(params)).then(
        response => resolve(this.deserializeArray(
          response.data, params.attributes
        ))
      ).catch(
        error => reject(error)
      )
    })
  }

  /**
   * Update a resource. The resource should have an id assigned.
   * @param {object} params
   * @param {object} params.resource
   * @param {string|class} [params.type]
   * @param {object} [params.meta] - Meta field of JSON:API.
   * @param {string[]} [params.attributes] - Whitelist of attributes to fetch.
   * @param {object} [params.extra] - Object with custom parameters to send into
   * the custom path build method. Often an id that refers to the container of
   * this model.
   */
  update(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestUpdate(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  /**
   * Create a resource.
   * @param {object} params
   * @param {object} params.resource
   * @param {string|class} [params.type]
   * @param {object} [params.meta] - Meta field of JSON:API.
   * @param {string[]} [params.attributes] - Whitelist of attributes to fetch.
   * @param {object} [params.extra] - Object with custom parameters to send into
   * the custom path build method. Often an id that refers to the container of
   * this model.
   */
  create(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestCreate(params)).then(
        response => resolve(this.deserialize(response.data, params.attributes))
      ).catch(
        error => reject(error)
      )
    })
  }

  /**
   * Delete a resource.
   * @param {object} params
   * @param {object} params.resource - Should have at list an id attribute.
   * @param {string|class} [params.type]
   * @param {object} [params.meta] - Meta field of JSON:API.
   * @param {object} [params.extra] - Object with custom parameters to send into
   * the custom path build method. Often an id that refers to the container of
   * this model.
   */
  delete(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestDelete(params)).then(
        response => resolve(response.data)
      ).catch(
        error => reject(error)
      )
    })
  }

  /**
   * Perform a custom action
   * @param {object} params
   * @param {object|object[]} [params.resource]
   * @param {string|class} [params.type]
   * @param {string} params.action - Action to be performed. It will be appended
   * at the end of the url path.
   * @param {string} [params.method] - HTTP Method to execute. @default "POST"
   * @param {object} [params.meta] - Meta field of JSON:API.
   * @param {object} [params.extra] - Object with custom parameters to send into
   * the custom path build method. Often an id that refers to the container of
   * this model.
   */
  customAction(params){
    return new Promise((resolve, reject) => {
      axios(this.buildRequestCustomAction(params)).then(
        response => resolve(response.data)
      ).catch(
        error => reject(error)
      )
    })
  }

  /**
   * Allow requests not necessarily in JSON API.
   * @param {object} request - axios valid request.
   */
  customRequest(request){
    return axios(request)
  }

  /**
   * @private
   * Convert JSON:API data into its correspondent JS models.
   * @param {object} rawData
   * @param {object} rawData.data - JSON:API data field with attributes and
   * relationships.
   * @param {object[]} [rawData.included] - JSON:API included related resources.
   * @param {object} [params]
   * @param {object} params.attributes - List of whitelisted attributes to be
   * deserialized. Any other attribute in the JSON:API document will be ignored.
   */
  deserialize({ data, included = [] }, params = {}){
    let obj
    let { links = {}, relationships = {}} = data
    try {
      const className = _.upperFirst(pluralize.singular(_.camelCase(data.type)))
      const klass = this.models.find(
        (model) => model.name === className || model.type === data.type
      )

      obj = new klass()
    } catch(e) {
      obj = { type: data.type }
    }

    obj.id = data.id

    _.forEach(data.attributes, (value, key) => {
      if(!params.attributes || _.includes(params.attributes, key)) {
        obj[key] = value
      }
    })

    if (!_.isEmpty(links)) {
      obj.links = _.omit(links, 'first', 'last', 'prev', 'next')
      if (links.self) {
        obj.refresh = () => this.customRequest({ url: links.self })
      }
    }

    _.forEach(relationships, (value, key) => {
      if (_.has(obj, key)) {
        obj[key] = (_.isArray(obj[key])) ?
          _.map(
            value.data,
            elem => this.deserializeRelationship(elem, included)
          )
          : this.deserializeRelationship(value.data, included)
      }
    })

    return obj
  }

  /**
   * @private
   * Deserialize a relationship from a JSON:API object into its respective
   * models.
   * @param {object} elem - Related element coming from the relationship
   * attribute.
   * @param {object[]} included - Array of included elements coming from the
   * server.
   */
  deserializeRelationship(elem, included = []){
    const includedElem = _.find(
      included,
      (e) => e.type == elem.type && e.id == elem.id
    )
    if(includedElem){
      elem.attributes = includedElem.attributes
    }
    return this.deserialize({data: elem})
  }

  /**
   * @private
   * @param {object} rawData
   * @param {object[]} rawData.data - JSON:API "data" field value.
   * @param {object[]} [rawData.links] - JSON:API "links" field. The accepted
   * keys for pagination are "first", "last", "prev" and "next".
   * @param {object} [params]
   * @param {object} params.attributes - List of whitelisted attributes to be
   * deserialized. Any other attribute in the JSON:API document will be ignored.
   */
  deserializeArray({ data, links = [], included = [] }, params){
    const response = (_.isArray(data))
      ? _.map(data, elem => this.deserialize({data: elem, included}, params))
      : this.deserialize({data, included}, params)

    const paginationLinks = _.pick(links, 'first', 'last', 'prev', 'next')
    _.forOwn(paginationLinks, (value, key) => {
      response[key] = () => this.customRequest({ url: value })
    })

    return response
  }
}
