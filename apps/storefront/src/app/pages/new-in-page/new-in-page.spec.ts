import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewInPage } from './new-in-page';

describe('NewInPage', () => {
  let component: NewInPage;
  let fixture: ComponentFixture<NewInPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewInPage],
    }).compileComponents();

    fixture = TestBed.createComponent(NewInPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
