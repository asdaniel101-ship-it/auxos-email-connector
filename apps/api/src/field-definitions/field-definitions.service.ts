import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateFieldDefinitionDto } from './dto/update-field-definition.dto';

@Injectable()
export class FieldDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.fieldDefinition.findMany({
      orderBy: [{ category: 'asc' }, { fieldName: 'asc' }],
    });
  }

  async upsertMany(definitions: UpdateFieldDefinitionDto[]) {
    if (!definitions.length) {
      return this.findAll();
    }

    const operations = definitions.map((definition) =>
      this.prisma.fieldDefinition.upsert({
        where: { fieldName: definition.fieldName },
        update: {
          category: definition.category,
          fieldType: definition.fieldType,
          enteredFieldKey: definition.enteredFieldKey ?? definition.fieldName,
          chatFieldKey: definition.chatFieldKey ?? definition.fieldName,
          documentFieldKey: definition.documentFieldKey ?? definition.fieldName,
          businessDescription: definition.businessDescription ?? null,
          extractorLogic: definition.extractorLogic ?? null,
          whereToLook: definition.whereToLook ?? null,
          inAcord130: definition.inAcord130 ?? null,
          whereInAcord130: definition.whereInAcord130 ?? null,
          documentSources: definition.documentSources ?? [],
          alternateFieldNames: definition.alternateFieldNames ?? [],
        },
        create: {
          fieldName: definition.fieldName,
          category: definition.category,
          fieldType: definition.fieldType,
          enteredFieldKey: definition.enteredFieldKey ?? definition.fieldName,
          chatFieldKey: definition.chatFieldKey ?? definition.fieldName,
          documentFieldKey: definition.documentFieldKey ?? definition.fieldName,
          businessDescription: definition.businessDescription ?? null,
          extractorLogic: definition.extractorLogic ?? null,
          whereToLook: definition.whereToLook ?? null,
          inAcord130: definition.inAcord130 ?? null,
          whereInAcord130: definition.whereInAcord130 ?? null,
          documentSources: definition.documentSources ?? [],
          alternateFieldNames: definition.alternateFieldNames ?? [],
        },
      }),
    );

    await this.prisma.$transaction(operations);

    return this.findAll();
  }
}
