import { findPriceRule } from "../src/conversation/conversation.service"

interface PriceRule {
  id: number
  name: string
  price_per_hour: number
  start_time: string
  end_time: string
  day_type: "NORMAL" | "WEEKEND"
  min_people: number
  max_people: number
}

const rules: PriceRule[] = [

{ id:1,name:"Box 1 người",price_per_hour:15000,start_time:"06:00",end_time:"13:59",day_type:"NORMAL",min_people:1,max_people:1 },
{ id:2,name:"Box 1 người",price_per_hour:30000,start_time:"14:00",end_time:"17:59",day_type:"NORMAL",min_people:1,max_people:1 },
{ id:3,name:"Box 1 người",price_per_hour:60000,start_time:"18:00",end_time:"05:59",day_type:"NORMAL",min_people:1,max_people:1 },

{ id:4,name:"Box 2-3 người",price_per_hour:25000,start_time:"06:00",end_time:"13:59",day_type:"NORMAL",min_people:2,max_people:3 },
{ id:5,name:"Box 2-3 người",price_per_hour:45000,start_time:"14:00",end_time:"17:59",day_type:"NORMAL",min_people:2,max_people:3 },
{ id:6,name:"Box 2-3 người",price_per_hour:85000,start_time:"18:00",end_time:"05:59",day_type:"NORMAL",min_people:2,max_people:3 },

{ id:7,name:"Box 4-6 người",price_per_hour:30000,start_time:"06:00",end_time:"13:59",day_type:"NORMAL",min_people:4,max_people:6 },
{ id:8,name:"Box 4-6 người",price_per_hour:55000,start_time:"14:00",end_time:"17:59",day_type:"NORMAL",min_people:4,max_people:6 },
{ id:9,name:"Box 4-6 người",price_per_hour:115000,start_time:"18:00",end_time:"05:59",day_type:"NORMAL",min_people:4,max_people:6 },

{ id:10,name:"Box 7-10 người",price_per_hour:45000,start_time:"06:00",end_time:"13:59",day_type:"NORMAL",min_people:7,max_people:10 },
{ id:11,name:"Box 7-10 người",price_per_hour:65000,start_time:"14:00",end_time:"17:59",day_type:"NORMAL",min_people:7,max_people:10 },
{ id:12,name:"Box 7-10 người",price_per_hour:135000,start_time:"18:00",end_time:"05:59",day_type:"NORMAL",min_people:7,max_people:10 },

{ id:13,name:"Box 1 người",price_per_hour:30000,start_time:"06:00",end_time:"13:59",day_type:"WEEKEND",min_people:1,max_people:1 },
{ id:14,name:"Box 1 người",price_per_hour:60000,start_time:"14:00",end_time:"17:59",day_type:"WEEKEND",min_people:1,max_people:1 },
{ id:15,name:"Box 1 người",price_per_hour:90000,start_time:"18:00",end_time:"05:59",day_type:"WEEKEND",min_people:1,max_people:1 },

{ id:16,name:"Box 2-3 người",price_per_hour:45000,start_time:"06:00",end_time:"13:59",day_type:"WEEKEND",min_people:2,max_people:3 },
{ id:17,name:"Box 2-3 người",price_per_hour:65000,start_time:"14:00",end_time:"17:59",day_type:"WEEKEND",min_people:2,max_people:3 },
{ id:18,name:"Box 2-3 người",price_per_hour:90000,start_time:"18:00",end_time:"05:59",day_type:"WEEKEND",min_people:2,max_people:3 },

{ id:19,name:"Box 4-6 người",price_per_hour:55000,start_time:"06:00",end_time:"13:59",day_type:"WEEKEND",min_people:4,max_people:6 },
{ id:20,name:"Box 4-6 người",price_per_hour:75000,start_time:"14:00",end_time:"17:59",day_type:"WEEKEND",min_people:4,max_people:6 },
{ id:21,name:"Box 4-6 người",price_per_hour:120000,start_time:"18:00",end_time:"05:59",day_type:"WEEKEND",min_people:4,max_people:6 },

{ id:22,name:"Box 7-10 người",price_per_hour:60000,start_time:"06:00",end_time:"13:59",day_type:"WEEKEND",min_people:7,max_people:10 },
{ id:23,name:"Box 7-10 người",price_per_hour:85000,start_time:"14:00",end_time:"17:59",day_type:"WEEKEND",min_people:7,max_people:10 },
{ id:24,name:"Box 7-10 người",price_per_hour:150000,start_time:"18:00",end_time:"05:59",day_type:"WEEKEND",min_people:7,max_people:10 }

]

function isWeekendCase(i:number){
  return i % 2 === 0
}

function generateCases(){

  const times = [
    "06:00","07:30","09:00","11:00","13:30",
    "14:00","15:30","16:45","17:59",
    "18:00","19:30","21:00","22:30","23:59",
    "00:30","02:00","04:30","05:59"
  ]

  const peoples = [1,2,3,4,5,6,7,8,9,10]

  const cases:any[] = []

  for(const t of times){

    for(const p of peoples){

      cases.push({
        time:t,
        people:p,
        weekend:isWeekendCase(p)
      })

      if(cases.length >= 100) return cases
    }
  }

  return cases
}

describe("findPriceRule 100 cases",()=>{

  const cases = generateCases()

  it("should match correct rule",()=>{

    for(const c of cases){

      const rule = findPriceRule(
        rules,
        c.time,
        c.people,
        c.weekend
      )

      console.log(
        c.time,
        c.people,
        c.weekend ? "weekend":"normal",
        "→",
        rule?.name,
        rule?.price_per_hour
      )

      expect(rule).not.toBeNull()

    }

  })

})