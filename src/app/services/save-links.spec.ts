import { TestBed } from '@angular/core/testing';

import { SaveLinks } from './save-links';

describe('SaveLinks', () => {
  let service: SaveLinks;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SaveLinks);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
