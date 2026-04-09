import { Controller, Post, Body } from "@nestjs/common";
import { R2Service } from "./r2.service";

@Controller("api/v1/r2")
export class R2Controller {
  constructor(private r2: R2Service) {}

  @Post("presign")
  async presign(@Body() body: { fileName: string; contentType: string }) {
    return this.r2.presign(body.fileName, body.contentType);
  }
}