import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TerminalComponent } from './terminal.component';
import { RunStateService } from '../../../core/services/run-state.service';
import { SignalrService } from '../../../core/services/signalr.service';
import { SessionService } from '../../../core/services/session.service';
import { RunState } from '../../../core/models/run-state.model';

describe('TerminalComponent', () => {
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
    ]);

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
    fixture.detectChanges();
  });

  it('should be hidden initially', () => {
    expect(component.isVisible).toBeFalse();
  });

  it('should become visible on compiling event', () => {
    runStateService.handleRunCompiling();
    expect(component.isVisible).toBeTrue();
  });

  it('should show isRunning when running', () => {
    runStateService.handleRunStarted('run-1');
    expect(component.isRunning).toBeTrue();
  });

  it('should not be running when idle', () => {
    expect(component.isRunning).toBeFalse();
  });

  it('should show isRunning when waiting for input', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();
    expect(component.isRunning).toBeTrue();
  });

  it('should not be running after finished', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunFinished(0);
    expect(component.isRunning).toBeFalse();
  });

  it('should call signalr.stopRun on stop()', () => {
    runStateService.handleRunStarted('run-1');
    component.stop();
    expect(signalrService.stopRun).toHaveBeenCalledWith('ABC123');
  });

  it('should call signalr.sendRunInput on input submit', () => {
    runStateService.handleRunStarted('run-1');
    runStateService.handleRunWaiting();

    // Simulate input
    (component as any).inputBuffer = 'Ali';
    (component as any).isInputMode = true;
    (component as any).submitInput();

    expect(signalrService.sendRunInput).toHaveBeenCalledWith('ABC123', 'Ali');
  });

  it('should reset runCount on clear()', () => {
    runStateService.handleRunCompiling();
    runStateService.handleRunStarted('run-1');

    component.clear();

    expect((component as any).runCount).toBe(0);
  });

  it('should show stop button when running', () => {
    runStateService.handleRunStarted('run-1');
    fixture.detectChanges();

    const stopBtn = fixture.nativeElement.querySelector(
      '[data-testid="stop-button"]'
    );
    expect(stopBtn).toBeTruthy();
  });

  it('should hide stop button when idle', () => {
    fixture.detectChanges();
    const stopBtn = fixture.nativeElement.querySelector(
      '[data-testid="stop-button"]'
    );
    expect(stopBtn).toBeFalsy();
  });
});
