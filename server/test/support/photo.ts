import type { CatalogImage, ImageCandidate } from '@goease/contracts';

// Explicit test data: no claim that this fixture URL is a real place photograph.
export const fixturePhoto: CatalogImage = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/GoEase-test-fixture.jpg',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:GoEase-test-fixture.jpg',
  credit: 'GoEase test fixture author',
  license: 'CC-BY-SA-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  reviewed: true,
};
export const fixtureCandidate: ImageCandidate = {
  id: '123',
  title: 'File:GoEase test fixture',
  match: 'name',
  image: { ...fixturePhoto, reviewed: false },
};

export async function publishFixturePhotos(
  Place: ReturnType<
    typeof import('../../src/features/explore/explore.service.js').exploreService
  >['models']['Place'],
) {
  await Place.updateMany(
    {},
    { $set: { images: [fixturePhoto], publicationStatus: 'published' } },
  );
}
