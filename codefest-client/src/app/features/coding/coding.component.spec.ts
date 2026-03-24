import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { CodingComponent } from './coding.component';
import { SignalrService } from '../../core/services/signalr.service';
import { SessionService, SessionState } from '../../core/services/session.service';
import { RunStateService } from '../../core/services/run-state.service';
import { ActivityTrackerService } from '../../core/services/activity-tracker.service';
import { KioskService } from '../../core/services/kiosk.service';
import { SessionStatus } from '../../core/models/session.model';
import { RunState } from '../../core/models/run-state.model';
import { Challenge, DifficultyLevel } from '../../core/models/challenge.model';

describe('CodingComponent', () => {
  let component: CodingComponent;
  let fixture: ComponentFixture<CodingComponent>;
  let signalrService: jasmine.SpyObj<SignalrService>;
  let sessionStateSubject: BehaviorSubject<SessionState>;
  let runStateBehavior: BehaviorSubject<RunState>;
  let runEventsSubject: Subject<any>;
  let nextChallengeSubject: Subject<Challenge>;

  const mockChallenge: Challenge = {
    id: 1,
    title: 'Hello World',
    description: 'Print hello world',
    starterCode: 'Console.WriteLine("Hello");',
    order: 1,
    points: 100,
    timeLimitSeconds: 300,
    difficulty: DifficultyLevel.Easy,
    testCases: [],
    patternChecks: [],
  };

  const activeState: SessionState = {
    sessionCode: 'ABC123',
    sessionName: 'Test Session',
    studentId: 42,
    displayName: 'Raed',
    status: SessionStatus.Active,
    currentChallenge: mockChallenge,
    currentChallengeIndex: 0,
    totalChallenges: 3,
    totalPoints: 0,
    leaderboard: [],
    lastResult: null,
    hints: [],
    broadcasts: [],
  };

  // SignalR subject instances — must be created before each test
  let connected$: BehaviorSubject<boolean>;
  let sessionStarted$: Subject<any>;
  let sessionPaused$: Subject<void>;
  let sessionResumed$: Subject<void>;
  let sessionEnded$: Subject<any>;
  let testResults$: Subject<any>;
  let hintReceived$: Subject<any>;
  let broadcastReceived$: Subject<any>;
  let celebration$: Subject<any>;
  let leaderboardUpdated$: Subject<any>;
  let error$: Subject<string>;
  let sessionDeleted$: Subject<void>;
  let sessionReopened$: Subject<void>;
  let reconnecting$: Subject<void>;
  let reconnected$: Subject<void>;
  let studentRunStarted$: Subject<any>;
  let studentRunStopped$: Subject<any>;

  beforeEach(async () => {
    // Create fresh subjects for each test
    connected$ = new BehaviorSubject<boolean>(false);
    sessionStarted$ = new Subject();
    sessionPaused$ = new Subject();
    sessionResumed$ = new Subject();
    sessionEnded$ = new Subject();
    testResults$ = new Subject();
    nextChallengeSubject = new Subject<Challenge>();
    hintReceived$ = new Subject();
    broadcastReceived$ = new Subject();
    celebration$ = new Subject();
    leaderboardUpdated$ = new Subject();
    error$ = new Subject();
    sessionDeleted$ = new Subject();
    sessionReopened$ = new Subject();
    reconnecting$ = new Subject();
    reconnected$ = new Subject();
    studentRunStarted$ = new Subject();
    studentRunStopped$ = new Subject();

    signalrService = jasmine.createSpyObj(
      'SignalrService',
      ['runCode', 'submitCode', 'stopRun', 'reconnectToRun', 'logActivity'],
      {
        connected$,
        sessionStarted$,
        sessionPaused$,
        sessionResumed$,
        sessionEnded$,
        testResults$,
        nextChallenge$: nextChallengeSubject,
        hintReceived$,
        broadcastReceived$,
        celebration$,
        leaderboardUpdated$,
        error$,
        sessionDeleted$,
        sessionReopened$,
        reconnecting$,
        reconnected$,
        studentRunStarted$,
        studentRunStopped$,
      }
    );
    signalrService.runCode.and.returnValue(Promise.resolve());
    signalrService.submitCode.and.returnValue(Promise.resolve());
    signalrService.stopRun.and.returnValue(Promise.resolve());

    // Session service mock with BehaviorSubject
    sessionStateSubject = new BehaviorSubject<SessionState>({ ...activeState });
    const mockSessionService = {
      state: sessionStateSubject.asObservable(),
      snapshot: activeState,
      clearLastResult: jasmine.createSpy('clearLastResult'),
    };

    // RunState service mock
    runStateBehavior = new BehaviorSubject<RunState>(RunState.Idle);
    runEventsSubject = new Subject();
    const mockRunStateService = {
      state$: runStateBehavior.asObservable(),
      events$: runEventsSubject.asObservable(),
      currentState: RunState.Idle,
      handleRunCompiling: jasmine.createSpy('handleRunCompiling'),
      handleRunStarted: jasmine.createSpy('handleRunStarted'),
      handleRunFinished: jasmine.createSpy('handleRunFinished'),
      reset: jasmine.createSpy('reset'),
    };

    const mockActivityTracker = jasmine.createSpyObj('ActivityTrackerService', [
      'updateCode',
      'startTracking',
      'stopTracking',
    ]);

    const mockKioskService = {
      isElectron: false,
      onMonitorWarning: jasmine.createSpy('onMonitorWarning'),
      onExitConfirmation: jasmine.createSpy('onExitConfirmation'),
      onSubmitAndExit: jasmine.createSpy('onSubmitAndExit'),
      onSecurityViolation: jasmine.createSpy('onSecurityViolation'),
      exitKioskMode: jasmine.createSpy('exitKioskMode'),
      confirmExit: jasmine.createSpy('confirmExit'),
      cancelExit: jasmine.createSpy('cancelExit'),
      sessionEndedExit: jasmine.createSpy('sessionEndedExit'),
    };

    const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CodingComponent],
      providers: [
        { provide: SignalrService, useValue: signalrService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: RunStateService, useValue: mockRunStateService },
        { provide: ActivityTrackerService, useValue: mockActivityTracker },
        { provide: KioskService, useValue: mockKioskService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CodingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // --- Run button integration tests ---

  it('should send starter code when Run clicked without editing', async () => {
    await component.runCode();

    expect(signalrService.runCode).toHaveBeenCalledWith(
      'ABC123',
      1,
      'Console.WriteLine("Hello");'
    );
  });

  it('should send updated code when Run clicked after editing', async () => {
    component.onCodeChange('Console.WriteLine("Updated");');

    await component.runCode();

    expect(signalrService.runCode).toHaveBeenCalledWith(
      'ABC123',
      1,
      'Console.WriteLine("Updated");'
    );
  });

  it('should not call runCode when currentChallenge is null', async () => {
    sessionStateSubject.next({
      ...activeState,
      currentChallenge: null,
    });
    fixture.detectChanges();

    await component.runCode();

    expect(signalrService.runCode).not.toHaveBeenCalled();
  });

  it('should not call runCode when isRunActive is true', async () => {
    // Simulate run active by pushing a Running state
    runStateBehavior.next(RunState.Running);
    fixture.detectChanges();

    await component.runCode();

    expect(signalrService.runCode).not.toHaveBeenCalled();
  });

  it('should disable Run button when session is not Active', () => {
    sessionStateSubject.next({
      ...activeState,
      status: SessionStatus.Paused,
    });
    fixture.detectChanges();

    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="run-button"]'
    );
    expect(runBtn.disabled).toBeTrue();
  });

  it('should disable Run button when isRunActive', () => {
    runStateBehavior.next(RunState.Running);
    fixture.detectChanges();

    const runBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="run-button"]'
    );
    expect(runBtn.disabled).toBeTrue();
  });

  it('should update currentCode when next challenge arrives', async () => {
    const newChallenge: Challenge = {
      ...mockChallenge,
      id: 2,
      title: 'Challenge 2',
      starterCode: 'int x = 0;',
    };

    // Simulate SessionService also updating state (as it would in production)
    sessionStateSubject.next({
      ...activeState,
      currentChallenge: newChallenge,
      currentChallengeIndex: 1,
    });

    nextChallengeSubject.next(newChallenge);
    fixture.detectChanges();

    // The component should have reset currentCode to the new starterCode
    await component.runCode();

    expect(signalrService.runCode).toHaveBeenCalledWith(
      'ABC123',
      2,
      'int x = 0;'
    );
  });
});
