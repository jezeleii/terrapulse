import axios from "axios"; 

export const apiClient = axios.create({
     baseURL: 'https://newsapi.org/v2',
  timeout: 10_000,
  headers: { 'X-Api-Key': process.env.NEWS_API_KEY! }
});