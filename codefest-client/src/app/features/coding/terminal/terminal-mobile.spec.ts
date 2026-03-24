import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TerminalComponent } from './terminal.component';
import { RunStateService } from '../../../core/services/run-state.service';
import { SignalrService } from '../../../core/services/signalr.service';
import { SessionService } from '../../../core/services/session.service';
import { Subject } from 'rxjs';

describe('Terminal — Mobile Input', () => {
  let component: TerminalComponent;
  let fixture: ComponentFixture<TerminalComponent>;
  let runStateService: RunStateService;
  let signalrService: jasmine.SpyObj<SignalrService>;

  const mockSessionService = {
    snapshot: { sessionCode: 'ABC123' },
    state: { subscribe: () => ({ unsubscribe: () => {} }) },
  };

  beforeEach(async () => {
    signalrService = jasmine.createSpyObj('SignalrService', [
      'sendRunInput',
      'stopRun',
      'connect',
      'runCode',
      'reconnectToRun',
    ], {
      reconnecting$: new Subject<void>(),
      reconnected$: new Subject<void>(),
    });

    await TestBed.configureTestingModule({
      imports: [TerminalComponent],
      providers: [
        RunStateService,
        { provide: SignalrService, useValue: signalrService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminalComponent);
    component = fixture.componentInstance;
    runStateService = TestBed.inject(RunStateService);

    // Mock as touch device
    spyOn(component, 'isTouchDevice').and.returnValue(true);

    fixture.detectChanges();
  });

  it('should show mobile input bar when WaitingForInput on touch device', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();

    expect(component.showMobileInput).toBeTrue();
    const inputBar = fixture.nativeElement.querySelector(
      '[data-testid="mobile-input-bar"]'
    );
    expect(inputBar).toBeTruthy();
    expect(inputBar.classList.contains('hidden')).toBeFalse();
  });

  it('should hide mobile input bar after sending input', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();

    component.mobileInputValue = 'test input';
    component.submitMobileInput();
    fixture.detectChanges();

    expect(component.showMobileInput).toBeFalse();
    expect(component.mobileInputValue).toBe('');
  });

  it('should send input via SignalR on mobile submit', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();

    component.mobileInputValue = 'Ali';
    component.submitMobileInput();

    expect(signalrService.sendRunInput).toHaveBeenCalledWith('ABC123', 'Ali');
  });

  it('should send input on Send button tap', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();

    component.mobileInputValue = 'TapInput';
    const sendBtn = fixture.nativeElement.querySelector(
      '[data-testid="mobile-send-button"]'
    );
    sendBtn.click();

    expect(signalrService.sendRunInput).toHaveBeenCalledWith(
      'ABC123',
      'TapInput'
    );
  });

  it('should hide mobile input bar on run error', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    expect(component.showMobileInput).toBeTrue();

    runStateService.handleRunError('NullReferenceException');
    fixture.detectChanges();
    expect(component.showMobileInput).toBeFalse();
  });

  it('should hide mobile input bar on run finished', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();
    expect(component.showMobileInput).toBeTrue();

    runStateService.handleRunFinished(0);
    fixture.detectChanges();
    expect(component.showMobileInput).toBeFalse();
  });

  it('should show copy button on touch device', () => {
    fixture.detectChanges();
    const copyBtn = fixture.nativeElement.querySelector(
      '[data-testid="copy-output-button"]'
    );
    expect(copyBtn).toBeTruthy();
  });
});

describe('Terminal — Desktop (no mobile input)', () => {
  let component: TerminalComponent;
  let fixture: ComponentFixture<TerminalComponent>;
  let runStateService: RunStateService;
  let signalrService: jasmine.SpyObj<SignalrService>;

  const mockSessionService = {
    snapshot: { sessionCode: 'ABC123' },
    state: { subscribe: () => ({ unsubscribe: () => {} }) },
  };

  beforeEach(async () => {
    signalrService = jasmine.createSpyObj('SignalrService', [
      'sendRunInput',
      'stopRun',
      'connect',
      'runCode',
      'reconnectToRun',
    ], {
      reconnecting$: new Subject<void>(),
      reconnected$: new Subject<void>(),
    });

    await TestBed.configureTestingModule({
      imports: [TerminalComponent],
      providers: [
        RunStateService,
        { provide: SignalrService, useValue: signalrService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminalComponent);
    component = fixture.componentInstance;
    runStateService = TestBed.inject(RunStateService);

    // Mock as desktop
    spyOn(component, 'isTouchDevice').and.returnValue(false);

    fixture.detectChanges();
  });

  it('should NOT show mobile input bar on desktop', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    fixture.detectChanges();

    expect(component.showMobileInput).toBeFalse();
  });
});
