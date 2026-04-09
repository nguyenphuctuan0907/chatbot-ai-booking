import { Injectable } from '@nestjs/common'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

@Injectable()
export class R2Service {

  private s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY as string,
      secretAccessKey: process.env.R2_SECRET_KEY as string
    }
  })

  async presign(fileName: string, contentType: string) {

    const ext = fileName.split('.').pop()

    const key = `uploads/${Date.now()}.${ext}`

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType
    })

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300
    })

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

    return {
      uploadUrl,
      publicUrl
    }
  }

}