import * as dotenv from "dotenv"
dotenv.config()

import { NestFactory } from "@nestjs/core"
import { Worker } from "bullmq"

import { BookingService } from "./booking.service"
import Redis from "ioredis"
import { BookingCoreModule } from "./BookingCoreModule.module"
import { checkAndBook } from "./common"
import dayjs from "dayjs"
import axios from "axios"

const pub = new Redis()

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(BookingCoreModule)

    const bookingService = app.get(BookingService)

    new Worker(
        "booking",
        async (job) => {
            try {
                const checkBooking = await bookingService.checkBookingInDay(job.data.day, job.data.userId)
                console.log("Processing booking job:", job.data, checkBooking)
                if (checkBooking.length > 0) {
                    const updatedBooking = await bookingService.updateBooking(checkBooking[0].id, {
                        ...checkBooking[0],
                        peopleCount: job.data.peopleCount,
                        checkIn: job.data.startTime,
                        checkOut: job.data.endTime,
                        roundedStartTime: job.data.roundedStartTime,
                        roundedEndTime: job.data.roundedEndTime,
                        day: job.data.day,
                        room: job.data.room!,
                    })
                    await pub.publish(
                        "booking.updated",
                        JSON.stringify({ currentBooking: checkBooking[0], updatedBooking: {...updatedBooking, ...job.data} })
                    )
                } else {
                    const newBooking = await bookingService.createBooking({
                        peopleCount: job.data.peopleCount,
                        checkIn: job.data.startTime,
                        checkOut: job.data.endTime,
                        roundedStartTime: job.data.roundedStartTime,
                        roundedEndTime: job.data.roundedEndTime,
                        day: job.data.day,
                        room: job.data.room!,
                        user: { connect: { id: job.data.userId } },
                        tenant: { connect: { id: job.data.tenantId } },
                        
                    })
                    await pub.publish(
                        "booking.created",
                        JSON.stringify({ ...job.data, ...newBooking })
                    )
                }
            } catch (err) {
                console.error("Error processing booking job:", err)
                // return {
                //         success: false,
                //         message: err.message,
                //         booking: err,
                //     }
                throw err // Ensure BullMQ knows the job failed
            }
        },
        {
            connection: {
                host: "localhost",
                port: 6379,
            },
        }
    )

    console.log("✅ Booking worker started")
}

bootstrap()