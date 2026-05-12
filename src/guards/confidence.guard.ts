import { Injectable } from "@nestjs/common";
import { AIParseResult } from "src/ai/ai.service";

@Injectable()
export class ConfidenceGuard {

check(aiResult:AIParseResult){

   if(aiResult.confidence < 0.65){
      throw new Error("LOW_CONFIDENCE");
   }

}
}