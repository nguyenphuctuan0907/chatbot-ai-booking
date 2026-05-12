import { Injectable } from "@nestjs/common";
import { AIParseResult } from "src/ai/ai.service";

@Injectable()
export class ValidatorService {

    validate(aiResult: AIParseResult) {

        if (aiResult.updates.people && aiResult.updates.people > 30) {
            throw Error();
        }

    }
}