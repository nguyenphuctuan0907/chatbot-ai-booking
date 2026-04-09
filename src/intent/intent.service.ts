import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIntentDto } from './dto/create-intent.dto';
import { UpdateIntentDto } from './dto/update-intent.dto';

@Injectable()
export class IntentService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIntentDto) {
    return this.prisma.intent.create({
      data: {
        name: dto.name,
        replyText: dto.replyText,
        isActive: dto.isActive ?? true,
        images: dto.images
          ? {
              create: dto.images.map((url) => ({ url })),
            }
          : undefined,
      },
      include: { images: true },
    });
  }

  async findAll() {
    const data = this.prisma.intent.findMany({
    //   orderBy: { createdAt: 'desc' },
    //   include: { images: true },
    });
    return data;
  }

  async findOne(id: number) {
    const intent = await this.prisma.intent.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!intent) throw new NotFoundException('Intent not found');

    return intent;
  }

  async update(id: number, dto: UpdateIntentDto) {
    await this.findOne(id);
    console.log({id, dto})
    return this.prisma.$transaction(async (tx) => {
      if (dto.images) {
        // Xoá toàn bộ image cũ rồi tạo lại
        await tx.intentImage.deleteMany({
          where: { intentId: id },
        });
      }

      return tx.intent.update({
        where: { id },
        data: {
          name: dto.name,
          replyText: dto.replyText,
          isActive: dto.isActive,
          images: dto.images
            ? {
                create: dto.images.map((url) => ({ url })),
              }
            : undefined,
        },
        include: { images: true },
      });
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.intent.delete({
      where: { id },
    });
  }
}