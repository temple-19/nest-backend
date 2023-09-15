// import *  from 'jest'
import { User } from '.prisma/client';
import { JwtService as _JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SaltService } from './salt.service';
import { expectToThrowWithMatchingError } from '../test/util';
jest.mock('@nestjs/jwt');
jest.mock('../users/users.service');
jest.mock('./salt.service');

// class under test
import { AuthService } from './auth.service';
import { JwtService } from '../lib/jwt/jwt.service';

/**
 * What does it look like with mocks?
 */
// TODO
describe('AuthService::UnitTest::Mocks', () => {
  /**
   * Classic mock based approach.
   */
  it('should return valid user', async () => {
    const mockedUsersService = jest.mocked(new UsersService({} as any));
    const mockedJwtService = jest.mocked(new _JwtService());
    const mockedSaltService = jest.mocked(new SaltService());

    // internals of the function are exposed and realistic values isolated.
    mockedUsersService.getPassword.mockResolvedValue('password');
    // mockedUsersService.getPassword.mockRejectedValue(new Error('what error?'));
    mockedSaltService.compare.mockResolvedValue(true);
    mockedUsersService.findOne.mockResolvedValue({
      email: 'email',
      id: 1,
      username: 'username',
      usersRoles: [],
    });

    const authService = new AuthService(
      mockedUsersService,
      mockedJwtService,
      mockedSaltService,
    );
    const user = await authService.validateUser('email', 'password');
    expect(user).toHaveProperty('email');
    expect(user).not.toHaveProperty('password');
  });
  it('should return a login token', async () => {
    const mockedUsersService = jest.mocked(new UsersService({} as any));
    const mockedJwtService = jest.mocked(new _JwtService());
    const mockedSaltService = jest.mocked(new SaltService());
    mockedJwtService.sign.mockReturnValue('somestring');
    const authService = new AuthService(
      mockedUsersService,
      mockedJwtService,
      mockedSaltService,
    );
    const { access_token } = await authService.login({
      email: 'email',
      id: 1,
      roles: [],
      username: 'username',
    });
    expect(access_token).toBeDefined();
    expect(access_token).toBe('somestring');
  });
});
fdescribe('AuthService::UnitTest::Fakes', () => {
  it('should return valid user', async () => {
    const { UsersService } = jest.requireActual('../users/users.service');
    const { SaltService } = jest.requireActual('./salt.service');
    // const { JwtService } = jest.requireActual('../lib/jwt/jwt.service');
    // const mockedUsersService = jest.mocked(new UsersService({} as any));
    // const mockedJwtService = jest.mocked(new JwtService());
    const mockedSaltService = jest.mocked(new SaltService());

    // internals of the function are exposed and realistic values isolated.
    // mockedUsersService.getPassword.mockResolvedValue('password');
    // mockedSaltService.compare.mockResolvedValue(false);
    // mockedUsersService.findOne.mockResolvedValue({
    //   email: 'email',
    //   id: 1,
    //   username: 'username',
    //   usersRoles: [],
    // });

    const authService = new AuthService(
      UsersService.createFake(),
      mockedSaltService,
      // JwtService.createFake(),
      SaltService.createFake(),
    );
    const user = await authService.validateUser('email', 'password');
    expect(user).toHaveProperty('email');
    expect(user).not.toHaveProperty('password');
  });

  it('should return a login token', async () => {
    const { UsersService } = jest.requireActual('../users/users.service');
    const { SaltService } = jest.requireActual('./salt.service');
    const authService = new AuthService(
      UsersService.createFake(),
      JwtService.createFake(),
      SaltService.createFake(),
    );
    const { access_token } = await authService.login({
      email: 'email',
      id: 1,
      roles: [],
      username: 'username',
    });
    expect(access_token).toBeDefined();
  });
});
/*
 * Example of traditional unit tests, but with no mocks, only fakes.
 * This already looks nearly just as clean as regular mocked tests.
 * Yes, we did have to write Fakes for every class.
 * However, those fakes are reusable, where as mocks are not.
 */
describe('AuthService::UnitTest', () => {
  // This is a simple mock-like example where we only test the method
  // under test.
  const setup = (users?: Partial<User>[]) => {
    const authService = new AuthService(
      UsersService.createFake({ users }),
      new _JwtService({ secret: 'secret' }),
      SaltService.createFake(),
    );
    return { authService };
  };

  it('should return valid user', async () => {
    const { authService } = setup();
    const user = await authService.validateUser('email', 'password');
    // TODO: validate structure with zod
    expect(user).toHaveProperty('email');
    expect(user).not.toHaveProperty('password');
  });

  /**
   * Here, fail paths are looking pretty easy... just pass in some
   * seed data and the fakes handle the semi-realistic setup.
   */
  it('should throw error when user not found', async () => {
    const { authService } = setup([
      {
        email: 'email',
      },
    ]);

    await expectToThrowWithMatchingError(
      authService.validateUser.bind(authService, 'wrongemail', 'password'),
      'unable to validate user',
    );
  });

  it('should throw error when passwords do not match', async () => {
    const { authService } = setup([
      {
        email: 'email',
        password: 'password',
      },
    ]);
    await expectToThrowWithMatchingError(
      authService.validateUser.bind(authService, 'email', 'wrongpassword'),
      'unable to validate user',
    );
  });

  it('should return an access token', async () => {
    const { authService } = setup();
    const { access_token } = await authService.login({
      email: 'email',
      id: 1,
      roles: [],
      username: 'username',
    });
    const jwtService = new _JwtService();
    expect(jwtService.decode(access_token)).toBeDefined();
    // TODO: test structure with zod.
  });
});

/**
 * These are super great for many reasons:
 * - They are "social" that is they lightly test the interactions between multiple tests. More coverage.
 * - They leverage the fakes where they want to be optionally deep.
 * - They do not require infrastructure or mocks, so they run FAST.
 * - It's really not too complex, the number of code lines compared to power is a decent tradeoff.
 */
describe('AuthService::DeepTest', () => {
  const saltService = new SaltService();
  const originalPassword = 'password';
  const email = 'email';
  // Also a class that should just work out of the box.
  const jwtService = new _JwtService({ secret: 'secret' });

  const setup = async () => {
    // Create a valid password (it's util functions after all)
    const generatedPassword = await saltService.hashPassword(originalPassword);
    const userService = UsersService.createFake({
      users: [{ email: email, password: generatedPassword }],
    });

    // Service Under Test
    const authService = new AuthService(userService, jwtService, saltService);
    return { authService };
  };

  it('returns user when password is valid', async () => {
    // Test
    const { authService } = await setup();
    const user = await authService.validateUser(email, originalPassword);
    expect(user.email).toEqual(email);
  });

  it('throws an error when password is wrong', async () => {
    const { authService } = await setup();
    const errorMessage = 'unable to validate user';
    await expectToThrowWithMatchingError(
      authService.validateUser.bind(authService, email, 'bad password'),
      errorMessage,
    );
  });

  it('should issue a JWT token for a user', async () => {
    const { authService } = await setup();
    const { access_token } = await authService.login({
      email: 'email',
      id: 1,
      roles: ['ADMIN', 'USER'],
      username: 'username',
    });
    const token = jwtService.decode(access_token);
    expect(token).toHaveProperty('email');
  });
});
