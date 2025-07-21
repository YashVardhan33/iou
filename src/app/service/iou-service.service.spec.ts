import { TestBed } from '@angular/core/testing';

import { IouServiceService } from './iou-service.service';

describe('IouServiceService', () => {
  let service: IouServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IouServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
