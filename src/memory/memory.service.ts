import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { Entity, Memory } from 'src/conversation/conversation.service'

const redis = new Redis()

@Injectable()
export class MemoryService {

 async get(userId: string) {

   const data = await redis.get(`chat:memory:${userId}`)

   if (!data) {
     return {
       entity: {},
        history: []
     }
   }

   return JSON.parse(data)
 }

 async save(userId: string, memory: Memory) {

   await redis.set(
     `chat:memory:${userId}`,
     JSON.stringify(memory),
     "EX",
     3600 // 1 hour expiration
   )
 }

 async clear(userId: string) {
   await redis.del(`chat:memory:${userId}`)
 }

}