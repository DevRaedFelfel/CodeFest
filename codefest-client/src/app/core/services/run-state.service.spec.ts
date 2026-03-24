import { TestBed } from '@angular/core/testing';
import { RunStateService } from './run-state.service';
import { RunState, RunEvent } from '../models/run-state.model';

describe('RunStateService', () => {
  let service: RunStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RunStateService);
  });

  it('should start in Idle state', () => {
    expect(service.currentState).toBe(RunState.Idle);
  });

  it('should transition to Compiling on handleRunCompiling', () => {
    service.handleRunCompiling();
    expect(service.currentState).toBe(RunState.Compiling);
  });

  it('should transition to Running on handleRunStarted', () => {
    service.handleRunStarted('run-123');
    expect(service.currentState).toBe(RunState.Running);
  });

  it('should transition to WaitingForInput on handleRunWaiting', () => {
    service.handleRunStarted('run-123');
    service.handleRunWaiting();
    expect(service.currentState).toBe(RunState.WaitingForInput);
  });

  it('should return to Running on handleRunInputEcho', () => {
    service.handleRunStarted('run-123');
    service.handleRunWaiting();
    service.handleRunInputEcho('Ali');
    expect(service.currentState).toBe(RunState.Running);
  });

  it('should transition to Error on handleRunCompileError', () => {
    service.handleRunCompileError([
      { message: '; expected', line: 3, column: 1, severity: 'Error' },
    ]);
    expect(service.currentState).toBe(RunState.Error);
  });

  it('should transition to Error on handleRunError', () => {
    service.handleRunError('NullReferenceException');
    expect(service.currentState).toBe(RunState.Error);
  });

  it('should transition to Finished on handleRunFinished', () => {
    service.handleRunStarted('run-123');
    service.handleRunFinished(0);
    expect(service.currentState).toBe(RunState.Finished);
  });

  it('should emit events in order', (done) => {
    const events: RunEvent[] = [];
    service.events$.subscribe((e) => {
      events.push(e);
      if (events.length === 3) {
        expect(events[0].type).toBe('compiling');
        expect(events[1].type).toBe('started');
        expect(events[2].type).toBe('output');
        done();
      }
    });

    service.handleRunCompiling();
    service.handleRunStarted('run-1');
    service.handleRunOutput('Hello');
  });

  it('should increment run count on each start', () => {
    const counts: number[] = [];
    service.runCount$.subscribe((c) => counts.push(c));

    service.handleRunStarted('run-1');
    service.handleRunStarted('run-2');

    expect(counts).toContain(1);
    expect(counts).toContain(2);
  });

  it('should reset to Idle', () => {
    service.handleRunStarted('run-1');
    service.reset();
    expect(service.currentState).toBe(RunState.Idle);
  });

  it('should emit output events with correct data', () => {
    let received: RunEvent | null = null;
    service.events$.subscribe((e) => {
      if (e.type === 'output') received = e;
    });

    service.handleRunOutput('Hello, World!');

    expect(received).not.toBeNull();
    expect(received!.data).toBe('Hello, World!');
    expect(received!.timestamp).toBeDefined();
  });

  it('should emit finished event with exit code', () => {
    let received: RunEvent | null = null;
    service.events$.subscribe((e) => {
      if (e.type === 'finished') received = e;
    });

    service.handleRunFinished(1);

    expect(received).not.toBeNull();
    expect(received!.data).toBe(1);
  });

  it('should emit compileError event with error list', () => {
    let received: RunEvent | null = null;
    service.events$.subscribe((e) => {
      if (e.type === 'compileError') received = e;
    });

    const errors = [
      { message: 'error1', line: 1, column: 1, severity: 'Error' },
      { message: 'error2', line: 2, column: 5, severity: 'Error' },
    ];
    service.handleRunCompileError(errors);

    expect(received).not.toBeNull();
    expect(received!.data).toEqual(errors);
  });
});
