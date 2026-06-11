import { PrismaClient } from '@prisma/client';
import { sampleCatalog } from '../src/services/catalog-fixtures.js';

const prisma = new PrismaClient();

async function main() {
  for (const category of sampleCatalog.categories) {
    await prisma.catalogCategory.upsert({
      where: { slug: category.slug },
      update: {
        title: category.title,
        imageUrl: category.imageUrl,
        isLaunchCategory: true,
        isActive: true,
      },
      create: {
        title: category.title,
        slug: category.slug,
        imageUrl: category.imageUrl,
        isLaunchCategory: true,
        isActive: true,
      },
    });
  }

  for (const product of sampleCatalog.products) {
    const category = await prisma.catalogCategory.findUnique({
      where: { slug: product.categorySlug },
    });

    const createdProduct = await prisma.catalogProduct.upsert({
      where: { slug: product.slug },
      update: {
        printfulId: product.printfulId,
        title: product.title,
        type: product.type,
        brand: product.brand,
        description: product.description,
        thumbnailUrl: product.thumbnailUrl,
        categoryId: category?.id,
        isSellable: true,
        isActive: true,
      },
      create: {
        printfulId: product.printfulId,
        title: product.title,
        slug: product.slug,
        type: product.type,
        brand: product.brand,
        description: product.description,
        thumbnailUrl: product.thumbnailUrl,
        categoryId: category?.id,
        isSellable: true,
        isActive: true,
      },
    });

    for (const variant of product.variants) {
      const createdVariant = await prisma.catalogVariant.upsert({
        where: { id: variant.id },
        update: {
          printfulVariantId: variant.printfulVariantId,
          name: variant.name,
          size: variant.size,
          color: variant.color,
          colorCode: variant.colorCode,
          imageUrl: variant.imageUrl,
          isAvailable: true,
        },
        create: {
          id: variant.id,
          printfulVariantId: variant.printfulVariantId,
          productId: createdProduct.id,
          name: variant.name,
          size: variant.size,
          color: variant.color,
          colorCode: variant.colorCode,
          imageUrl: variant.imageUrl,
          isAvailable: true,
        },
      });

      await prisma.priceSnapshot.create({
        data: {
          productId: createdProduct.id,
          variantId: createdVariant.id,
          amount: variant.costCents / 100,
          currency: 'USD',
          priceType: 'base',
          source: 'fixture',
        },
      });
    }

    for (const placement of product.placements) {
      await prisma.printPlacement.upsert({
        where: {
          productId_code_technique: {
            productId: createdProduct.id,
            code: placement.code,
            technique: placement.technique,
          },
        },
        update: {
          displayName: placement.displayName,
          technique: placement.technique,
          width: placement.width,
          height: placement.height,
          isDefault: placement.isDefault,
        },
        create: {
          productId: createdProduct.id,
          code: placement.code,
          displayName: placement.displayName,
          technique: placement.technique,
          width: placement.width,
          height: placement.height,
          isDefault: placement.isDefault,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
