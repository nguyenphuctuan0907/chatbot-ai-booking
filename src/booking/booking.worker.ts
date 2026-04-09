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
                        startTime: job.data.startTime,
                        endTime: job.data.endTime,
                        day: job.data.day,
                        room: job.data.room!,
                        roundedStartTime: job.data.roundedStartTime,
                        roundedEndTime: job.data.roundedEndTime,
                    })
                    await pub.publish(
                        "booking.updated",
                        JSON.stringify({ currentBooking: checkBooking[0], updatedBooking: {...updatedBooking, ...job.data} })
                    )
                } else {
                    const newBooking = await bookingService.createBooking({
                        peopleCount: job.data.peopleCount,
                        startTime: job.data.startTime,
                        endTime: job.data.endTime,
                        day: job.data.day,
                        room: job.data.room!,
                        roundedStartTime: job.data.roundedStartTime,
                        roundedEndTime: job.data.roundedEndTime,
                        user: { connect: { id: job.data.userId } }
                    })
                    await pub.publish(
                        "booking.created",
                        JSON.stringify({ ...job.data, ...newBooking })
                    )
                }


                // const bookings = await bookingService.getAllBookings(dayjs(job.data.startTime).format("DD/MM/YYYY"))

                // const bookingsByRoom = Object.values(
                //     bookings.reduce((acc, b) => {
                //         if (!acc[b.room]) {
                //             acc[b.room] = {
                //                 room: b.room,
                //                 orders: [],
                //             }
                //         }

                //         acc[b.room].orders.push({
                //             startTime: b.startTime,
                //             endTime: b.endTime,
                //             // inTime: b.inTime,
                //             // outTime: b.outTime,
                //         })

                //         return acc
                //     }, {} as Record<number, any>)
                // )

                // const mapRoomCount = {
                //     3: [1, 2, 3],
                //     12: [4],
                // }

                // const roomCanBook: number[] = []

                // for (const c of Object.keys(mapRoomCount)) {
                //     if (Number(c) >= Number(job.data.peopleCount)) {
                //         roomCanBook.push(...mapRoomCount[c])
                //     }
                // }
                // console.log({bookingsByRoom, roomCanBook})

                // const check = checkAndBook(bookingsByRoom, job.data.startTime, job.data.endTime, roomCanBook)

                // if (check.success) {
                //     const newBooking = await bookingService.createBooking({
                //         userId: job.data.userId,
                //         peopleCount: job.data.peopleCount,
                //         startTime: job.data.startTime,
                //         endTime: job.data.endTime,
                //         day: job.data.day,
                //         room: check.roomId!,
                //     })
                //     await pub.publish(
                //             "booking.created",
                //             JSON.stringify({ ...job.data, ...newBooking })
                //         )
                //     console.log("New booking created:", newBooking)
                //     await bookingService.updateConversationId(job.data.conversationId)

                //     await axios.post(
                //           `https://graph.facebook.com/v19.0/me/messages`,
                //           {
                //             recipient: { id: job.data.platformSenderId },
                //             message: { text: `Đặt phòng thành công! Phòng tên ${job.data.name}, ${check.roomId} từ ${dayjs(job.data.startTime).format("HH:mm DD/MM/YYYY")} đến ${dayjs(job.data.endTime).format("HH:mm DD/MM/YYYY")}` },
                //           },
                //           {
                //             params: {
                //               access_token: process.env.PAGE_ACCESS_TOKEN,
                //             },
                //           });

                // } else {
                //     console.log("No available rooms for the requested time and people count.", JSON.stringify(check.nearestAvailable))
                //     await axios.post(
                //           `https://graph.facebook.com/v19.0/me/messages`,
                //           {
                //             recipient: { id: job.data.platformSenderId },
                //             message: { text: `Rất tiếc hiện tại không còn phòng trống nào cho ${job.data.peopleCount} người vào lúc ${dayjs(job.data.startTime).format("HH:mm DD/MM/YYYY")}. Các khung giờ gần nhất có phòng trống là: ${check.nearestAvailable?.map(n => `phòng ${n.roomId} từ ${dayjs(n.startTime).format("HH:mm DD/MM/YYYY")} đến ${dayjs(n.endTime).format("HH:mm DD/MM/YYYY")}`).join("; ")}, Bạn có muốn đặt không ạ` },
                //           },
                //           {
                //             params: {
                //               access_token: process.env.PAGE_ACCESS_TOKEN,
                //             },
                //           });
                // }
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