import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpSupportPage } from './help-support-page';

describe('HelpSupportPage', () => {
  let component: HelpSupportPage;
  let fixture: ComponentFixture<HelpSupportPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpSupportPage],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpSupportPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
