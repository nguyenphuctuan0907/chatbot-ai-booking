// booking.module.ts

import { Module } from "@nestjs/common"
import { BookingController } from "./booking.controller"
import { BookingGateway } from "./booking.gateway"
import { BookingCoreModule } from "./BookingCoreModule.module"

@Module({
    imports: [BookingCoreModule],
    controllers: [BookingController],
    providers: [BookingGateway],
})
export class BookingModule {
    constructor() {
        console.log("🔥 BookingModule loaded")
    }
}