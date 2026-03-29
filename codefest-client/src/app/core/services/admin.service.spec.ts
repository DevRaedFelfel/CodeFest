import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Users ---

  it('should get users with pagination', () => {
    service.getUsers('Student', 'ali', 1, 20).subscribe((res) => {
      expect(res.items.length).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url === '/api/admin/users');
    expect(req.request.params.get('role')).toBe('Student');
    expect(req.request.params.get('search')).toBe('ali');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [{ id: 1 }], totalCount: 1, page: 1, pageSize: 20 });
  });

  it('should create a user', () => {
    service.createUser({ email: 'new@test.com', displayName: 'New', role: 'Student' }).subscribe();

    const req = httpMock.expectOne('/api/admin/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.email).toBe('new@test.com');
    req.flush({ id: 1 });
  });

  it('should deactivate a user', () => {
    service.deactivateUser(5).subscribe();

    const req = httpMock.expectOne('/api/admin/users/5');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // --- Courses ---

  it('should get courses', () => {
    service.getCourses().subscribe((courses) => {
      expect(courses.length).toBe(2);
    });

    const req = httpMock.expectOne('/api/admin/courses');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }, { id: 2 }]);
  });

  it('should create a course', () => {
    service.createCourse({ code: 'CS301', name: 'Algorithms', instructorId: 2 }).subscribe();

    const req = httpMock.expectOne('/api/admin/courses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.code).toBe('CS301');
    req.flush({ id: 3 });
  });

  // --- Enrollments ---

  it('should get enrollments', () => {
    service.getEnrollments(1, 'Active').subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/admin/enrollments');
    expect(req.request.params.get('courseId')).toBe('1');
    expect(req.request.params.get('status')).toBe('Active');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  });

  it('should create an enrollment', () => {
    service.createEnrollment({ studentId: 3, courseId: 1 }).subscribe();

    const req = httpMock.expectOne('/api/admin/enrollments');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 1 });
  });

  // --- Enrollment Requests ---

  it('should review an enrollment request', () => {
    service.reviewEnrollmentRequest(5, 'Approved').subscribe();

    const req = httpMock.expectOne('/api/admin/enrollment-requests/5');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.status).toBe('Approved');
    req.flush(null);
  });

  // --- Academic Loads ---

  it('should get academic loads', () => {
    service.getAcademicLoads().subscribe((loads) => {
      expect(loads.length).toBe(1);
    });

    const req = httpMock.expectOne('/api/admin/academic-loads');
    req.flush([{ id: 1 }]);
  });

  it('should create an academic load', () => {
    service.createAcademicLoad({ instructorId: 2, courseId: 1, term: 'Fall 2026' }).subscribe();

    const req = httpMock.expectOne('/api/admin/academic-loads');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 1 });
  });

  it('should upload users file', () => {
    const file = new File(['csv-data'], 'users.csv', { type: 'text/csv' });
    service.uploadUsers(file).subscribe();

    const req = httpMock.expectOne('/api/admin/users/upload');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush({ imported: 3, skipped: 0, errors: [] });
  });
});
