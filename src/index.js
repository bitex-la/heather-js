import axios from 'axios';

export function build_request(){
  const headers = {
    'Content-Type': 'application/vnd.api+json'
  }

  return {
    headers
  }
}

const Client = {
  build_request
};

export default Client;
