import { OnModuleInit } from "@nestjs/common"
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from "@nestjs/websockets"
import Redis from "ioredis"
import { Server, Socket } from "socket.io"

@WebSocketGateway({
    cors: true,
})
export class BookingGateway
    implements OnModuleInit {
    constructor() {
        console.log("🔥 BookingGateway loaded")
    }
    @WebSocketServer()
    server: Server

    async onModuleInit() {
        const sub = new Redis()
        console.log("🚀 Gateway init")
        await sub.subscribe("booking.created", (err, count) => {
            if (err) {
                console.error("Failed to subscribe: ", err)
            } else {
                console.log(`Subscribed successfully! This client is currently subscribed to ${count} channels.`)
            }
        })

        await sub.subscribe("booking.updated", (err, count) => {
            if (err) {
                console.error("Failed to subscribe: ", err)
            } else {
                console.log(`Subscribed successfully! This client is currently subscribed to ${count} channels.`)
            }
        })

        sub.on("message", (channel, message) => {
            console.log("Received message on channel:", channel)
            if (channel === "booking.created") {
                const data = JSON.parse(message)
                this.server.emit("booking_created", data)
            }else if(channel === "booking.updated") {
                const data = JSON.parse(message)
                this.server.emit("booking_updated", data)
            }
        })
    }

    handleConnection(client: Socket) {
        console.log("Client connected:", client.id)
    }

    handleDisconnect(client: Socket) {
        console.log("Client disconnected:", client.id)
    }

}