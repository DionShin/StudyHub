# StudyHub MVP 설계서

스터디 모집 및 참가 관리를 위한 백엔드 학습 프로젝트다. 회원이 스터디를 개설하고, 다른 회원이 참가를 신청하면 스터디장이 승인하거나 거절한다. 이 흐름을 구현하며 CRUD, 세션 인증, 권한 검사, MySQL 관계 설계와 JOIN, 트랜잭션을 익힌다.

## 1. MVP 핵심 기능

| 기능 | 내용 |
| --- | --- |
| 회원 관리 | 회원가입, 로그인, 로그아웃 |
| 스터디 관리 | 모집글 작성, 목록·상세 조회, 수정, 삭제 |
| 참가 신청 | 참가 신청, 신청·참가 취소 |
| 신청 관리 | 스터디장이 신청 목록을 조회하고 승인 또는 거절 |
| 모집 관리 | 최대 인원 설정, 모집 마감 |
| 마이페이지 | 내가 개설한 스터디와 내가 신청한 스터디 조회 |

실시간 채팅, 알림, 이미지 업로드, 소셜 로그인, 결제, 리뷰는 이후 확장 범위로 둔다.

## 2. MySQL ERD

```text
users (1)   ──< (N) studies       via studies.owner_id
users (1)   ──< (N) applications  via applications.user_id
studies (1) ──< (N) applications  via applications.study_id
```

각 모집글에는 스터디장 한 명이 있고, 각 신청에는 스터디 하나와 신청자 한 명이 연결된다. `N` 쪽에는 0개 이상의 행이 올 수 있다. PK는 기본키, FK는 외래키, UQ는 고유 제약(`UNIQUE`)을 뜻한다.

### users · 회원

| 컬럼 | 타입 | 제약 및 의미 |
| --- | --- | --- |
| `id` | `BIGINT` | PK, `AUTO_INCREMENT` |
| `email` | `VARCHAR(255)` | 이메일, `UNIQUE`, `NOT NULL` |
| `password_hash` | `VARCHAR(255)` | 해싱된 비밀번호 |
| `nickname` | `VARCHAR(30)` | 닉네임 |
| `created_at` | `DATETIME` | 가입일 |

### studies · 스터디 모집글

| 컬럼 | 타입 | 제약 및 의미 |
| --- | --- | --- |
| `id` | `BIGINT` | PK, `AUTO_INCREMENT` |
| `owner_id` | `BIGINT` | FK → `users.id`, 스터디장 |
| `title` | `VARCHAR(200)` | 모집글 제목 |
| `description` | `TEXT` | 스터디 설명 |
| `max_members` | `INT` | 스터디장을 포함한 최대 인원 |
| `status` | `ENUM` | `OPEN` 모집 중, `CLOSED` 모집 마감 |
| `created_at` | `DATETIME` | 생성일 |
| `updated_at` | `DATETIME` | 수정일 |

### applications · 참가 신청

| 컬럼 | 타입 | 제약 및 의미 |
| --- | --- | --- |
| `id` | `BIGINT` | PK, `AUTO_INCREMENT` |
| `study_id` | `BIGINT` | FK → `studies.id`, 신청 대상 |
| `user_id` | `BIGINT` | FK → `users.id`, 신청자 |
| `status` | `ENUM` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `created_at` | `DATETIME` | 최초 신청일 |
| `updated_at` | `DATETIME` | 상태 변경일 |

`UNIQUE(study_id, user_id)`로 회원과 스터디 조합마다 신청 기록을 한 건으로 제한한다. 스터디장과 신청자의 닉네임은 해당 외래키를 통해 `users`와 JOIN해서 가져온다.

## 3. 신청 상태와 정원 규칙

| 상태 | 의미 |
| --- | --- |
| `PENDING` | 신청 접수 후 검토 대기 |
| `APPROVED` | 스터디장이 승인한 참가 신청 |
| `REJECTED` | 스터디장이 거절한 참가 신청 |
| `CANCELLED` | 신청자가 신청 또는 참가를 취소한 상태 |

- **신청·재신청.** 로그인한 회원만 신청할 수 있다. 첫 신청은 `PENDING`으로 기록한다. 같은 스터디에 `PENDING` 또는 `APPROVED` 기록이 있으면 중복 신청을 차단한다. `REJECTED` 또는 `CANCELLED` 기록으로 재신청할 때는 기존 행을 `PENDING`으로 바꾼다. 스터디장의 자기 스터디 신청과 마감된 스터디의 신규 신청·재신청은 차단한다.
- **검토·취소.** 스터디장만 해당 스터디의 `PENDING` 신청을 `APPROVED` 또는 `REJECTED`로 바꿀 수 있다. 신청자는 자신의 대기 중 신청이나 승인된 참가를 취소할 수 있다. 취소는 기존 행을 유지하고 `CANCELLED`로 바꾼다.
- **정원.** 스터디장은 개설 시점부터 1명으로 센다. **현재 인원 = 1 + `APPROVED` 신청 수.** 현재 인원이 `max_members`에 도달하면 신규 신청·재신청과 추가 승인을 차단한다. 승인된 참가를 취소하면 현재 인원이 1명 줄어든다.
- **동시 승인.** 정원 확인과 승인 갱신을 같은 MySQL 트랜잭션에서 처리한다. 같은 스터디 행에 잠금을 건 뒤 현재 인원과 최대 인원을 다시 확인한다. 마지막 한 자리에 승인 요청 두 건이 겹치면 한 건만 성공해야 한다.

예를 들어 A가 정원 3명인 스터디를 개설하고 B와 C가 신청하면 두 건은 `PENDING`이다. B를 승인하고 C를 거절하면 A와 B를 합쳐 현재 인원은 2명이다. C가 재신청해 승인되면 현재 인원은 3명이 된다.

## 4. REST API

### 회원

| 메서드 | 경로 | 기능 |
| --- | --- | --- |
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/users/me` | 내 정보 조회 |

### 스터디

| 메서드 | 경로 | 기능 |
| --- | --- | --- |
| GET | `/api/studies` | 전체 스터디 조회 |
| GET | `/api/studies/:id` | 스터디 상세 조회 |
| POST | `/api/studies` | 스터디 개설 |
| PATCH | `/api/studies/:id` | 스터디장 모집글 수정·모집 마감 |
| DELETE | `/api/studies/:id` | 스터디장 모집글 삭제 |

### 참가 신청

| 메서드 | 경로 | 기능 |
| --- | --- | --- |
| POST | `/api/studies/:id/applications` | 참가 신청·재신청 |
| GET | `/api/studies/:id/applications` | 스터디장이 해당 스터디의 신청 목록 조회 |
| GET | `/api/users/me/applications` | 내 신청 목록 조회 |
| PATCH | `/api/applications/:id` | 스터디장이 신청 승인·거절 |
| DELETE | `/api/applications/:id` | 신청자가 신청·참가 취소 (`CANCELLED`) |

마이페이지에서 내가 개설한 스터디는 로그인 회원의 ID와 `studies.owner_id`가 일치하는 모집글을 조회한다. 이 조회의 API 경로는 구현 시 정한다.

## 5. 6단계 구현 로드맵

원문 본문의 개발 순서를 기준으로 참가 신청과 승인·거절을 한 단계로 묶었다.

1. **MySQL 설계·연결.** 세 테이블과 PK·FK·UNIQUE를 설정한다. 샘플 데이터를 넣고 JOIN으로 스터디장과 신청자를 조회한 뒤 `mysql2`로 연결을 확인한다.
2. **회원가입과 세션 인증.** 이메일 중복 검사, 비밀번호 해싱, 로그인·로그아웃, 내 정보 조회를 완성한다.
3. **스터디 CRUD.** 목록·상세 조회와 개설·수정·삭제를 구현한다. 스터디장 권한과 모집 마감 처리를 확인한다.
4. **참가 신청과 검토.** 신청·재신청·취소, 승인·거절, 신청 목록과 마이페이지 조회를 연결한다. 신청 상태와 현재 인원 계산을 검증한다.
5. **트랜잭션과 행 잠금.** 정원 확인과 승인 갱신을 묶는다. 마지막 한 자리를 동시에 승인해도 정원을 지키는지 검증한다.
6. **검색 및 마무리.** 스터디 목록 검색을 추가하고 입력 검증, 오류 응답, 예외 테스트를 점검한다.

## 6. 기술 스택

| 구분 | 기술 | 선택 이유 |
| --- | --- | --- |
| 백엔드 | Node.js + Express | HTTP 라우팅과 REST API 연습 |
| 데이터베이스 | MySQL | 관계형 DB 설계와 SQL 실습 |
| DB 드라이버 | `mysql2` | SQL 직접 작성 및 실행 |
| 인증 | `express-session` | 세션과 쿠키를 이용한 인증 |
| 비밀번호 | `bcrypt` | 비밀번호 해싱과 검증 |
| API 테스트 | Postman | HTTP 요청과 응답 검증 |
| 프론트엔드 | EJS (선택) | 최소한의 화면 구성 |
| 버전 관리 | Git / GitHub | 변경 이력 관리 |

SQL은 `mysql2`로 직접 작성한다. 사용자 입력은 파라미터 바인딩(Prepared Statement)으로 전달해 SQL 인젝션을 방지한다.

## 7. 예외 및 경계 테스트

| 상황 | 기대 결과 |
| --- | --- |
| 동일 이메일로 중복 가입 | `409 Conflict` |
| 로그인하지 않고 스터디 작성 | `401 Unauthorized` |
| 다른 사람의 스터디 수정 | `403 Forbidden` |
| 같은 스터디에 중복 신청 | `409 Conflict` |
| 스터디장이 본인 스터디에 신청 | `400 Bad Request` 또는 `409 Conflict` |
| 정원이 가득 찬 스터디에 신청 | `409 Conflict` |
| 스터디장이 아닌 회원이 신청 승인 시도 | `403 Forbidden` |
| 존재하지 않는 스터디 조회 | `404 Not Found` |
| 마감된 스터디에 신청 | 접수 차단. 신청 기록과 상태 유지 |
| 취소·거절 후 모집 중이고 자리가 있을 때 재신청 | 같은 신청 ID로 `PENDING` 전환 |
| 승인된 참가 취소 | 기존 기록이 `CANCELLED`로 전환되고 현재 인원 1명 감소 |
| 마지막 한 자리에 동시 승인 요청 두 건 | 한 건만 `APPROVED`로 전환. 정원 유지 |
