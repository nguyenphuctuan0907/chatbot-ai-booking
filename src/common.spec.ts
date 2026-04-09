import dayjs from "dayjs"
import { parseVietnameseTime } from "./common"

describe("Vietnamese Time Parser", () => {

  const tests: [string, string, number | null][] = [

    // =================
    // HÔM NAY
    // =================
    ["tối nay", "20:00", 0],
    ["chiều nay", "17:00", 0],
    ["sáng nay", "09:00", 0],
    ["hôm nay 21h", "21:00", 0],
    ["nay 19h", "19:00", 0],
    ["tối nay 8h", "20:00", 0],
    ["chiều nay 5h", "17:00", 0],
    ["sáng nay 8h", "08:00", 0],
    ["nay 6h sáng", "06:00", 0],
    ["nay 7h tối", "19:00", 0],

    // =================
    // HÔM NAY FUZZY
    // =================
    ["hôm nay khoảng 7h", "07:00", 0],
    ["hôm nay tầm 8h", "08:00", 0],

    // =================
    // MAI
    // =================
    ["mai 7h", "07:00", 1],
    ["sáng mai", "09:00", 1],
    ["chiều mai", "17:00", 1],
    ["tối mai", "20:00", 1],
    ["mai 19h", "19:00", 1],
    ["mai tầm 8h", "08:00", 1],
    ["mai khoảng 7h", "07:00", 1],
    ["mai 7h tối", "19:00", 1],
    ["mai 8h sáng", "08:00", 1],
    ["mai 5h chiều", "17:00", 1],
    ["mai 6h tối", "18:00", 1],
    ["mai lúc 7h", "07:00", 1],
    ["mai lúc 7h tối", "19:00", 1],

    // =================
    // ĐẢO VỊ TRÍ
    // =================
    ["7h tối mai", "19:00", 1],
    ["8h sáng mai", "08:00", 1],
    ["7h mai tối", "19:00", 1],
    ["tối mai 7h", "19:00", 1],
    ["sáng mai 8h", "08:00", 1],
    ["chiều mai 5h", "17:00", 1],

    // =================
    // MỐT
    // =================
    ["mốt 8h", "08:00", 2],
    ["sáng mốt", "09:00", 2],
    ["tối mốt", "20:00", 2],
    ["mốt 7h tối", "19:00", 2],
    ["mốt 8h sáng", "08:00", 2],
    ["chiều mốt", "17:00", 2],

    // =================
    // KIA
    // =================
    ["kia 7h", "07:00", 3],
    ["tối kia", "20:00", 3],
    ["sáng kia", "09:00", 3],
    ["kia 8h tối", "20:00", 3],
    ["kia 6h chiều", "18:00", 3],

    // =================
    // WEEKDAY
    // =================
    ["thứ 2 7h", "07:00", null],
    ["thứ 3 19h", "19:00", null],
    ["thứ 4 tối", "20:00", null],
    ["thứ 5 7h", "07:00", null],
    ["thứ 6 8h", "08:00", null],
    ["thứ 6 19h", "19:00", null],
    ["thứ 7 tối", "20:00", null],
    ["thứ 7 8h sáng", "08:00", null],
    ["cn 7h", "07:00", null],
    ["cn 7h tối", "19:00", null],
    ["t7 20h", "20:00", null],
    ["t6 18h", "18:00", null],
    ["t2 7h", "07:00", null],

    // =================
    // WEEKEND
    // =================
    ["cuối tuần", "20:00", null],
    ["cuối tuần 7h", "07:00", null],
    ["cuối tuần 8h tối", "20:00", null],
    ["cuối tuần buổi tối", "20:00", null],

    // =================
    // NGÀY CỤ THỂ
    // =================
    ["21/3 19h", "19:00", null],
    ["21/3 7h", "07:00", null],
    ["21/3 tối", "20:00", null],
    ["5-4 18h", "18:00", null],
    ["5-4 7h tối", "19:00", null],
    ["10/12 8h sáng", "08:00", null],
    ["1/1 9h", "09:00", null],

    // =================
    // MINUTE
    // =================
    ["7:30", "07:30", 0],
    ["7h30", "07:30", 0],
    ["8:15 tối", "20:15", 0],
    ["6h45 sáng", "06:45", 0],

    // =================
    // CHRONO FALLBACK
    // =================
    ["tomorrow 7pm", "19:00", 1],
    ["today 8pm", "20:00", 0],
    ["today 9am", "09:00", 0],

    // =================
    // CHATBOT THỰC TẾ
    // =================
    ["tối nay 2 người", "20:00", 0],
    ["chiều mai 3 người", "17:00", 1],
    ["mai tầm 7h", "07:00", 1],
    ["cho mình đặt phòng tối nay", "20:00", 0],
    ["tối nay đặt phòng", "20:00", 0],
    ["mai đặt phòng 7h", "07:00", 1],
    ["mai 7h còn phòng không", "07:00", 1],
    ["mai 7h cho 3 người", "07:00", 1],
    ["tối mai cho 4 người", "20:00", 1],
    ["đặt phòng mai 8h", "08:00", 1],
    ["mai đi hát 7h", "07:00", 1],

    // =================
    // NHIỄU SỐ
    // =================
    ["tối nay 3 người", "20:00", 0],
    ["mai 7h 4 người", "07:00", 1],
    ["mai 8h 5 người", "08:00", 1],
    ["mai 7h 2 phòng", "07:00", 1],

    // =================
    // EDGE CASE QUAN TRỌNG
    // =================
    ["1h", "01:00", null],
    ["2h", "02:00", null],
    ["3h", "03:00", null],
    ["4h", "04:00", null],
    ["5h", "05:00", null],

  ]

  it.each(tests)(
    "parse %s",
    (...args: [string, string, number | null]) => {

      const [text, expectedHour, addDay] = args

      const result = parseVietnameseTime(text)

      expect(result).not.toBeNull()

      expect(result?.start).toBe(expectedHour)

      if (addDay !== null) {

        const date = dayjs()
          .add(addDay, "day")
          .format("YYYY-MM-DD")

        expect(result?.date).toContain(date)

      }

    }
  )

})