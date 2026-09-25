import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const m=vi.hoisted(()=>({session:vi.fn()}));
vi.mock('next-auth/react',()=>({getSession:m.session}));
import { confirmedSignOut } from './confirmed-signout-client';
const fetchMock=vi.fn(),assign=vi.fn();
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('window',{location:{origin:'https://www.veggat.com',assign}});vi.stubGlobal('fetch',fetchMock);
  fetchMock.mockResolvedValueOnce(Response.json({csrfToken:'unit-only-csrf'}));m.session.mockResolvedValue(null);});
afterEach(()=>vi.unstubAllGlobals());
it('keeps the page/session visible after a server rejection and permits retry',async()=>{
  fetchMock.mockResolvedValueOnce(Response.json({error:'temporary failure'},{status:503}));
  await expect(confirmedSignOut()).rejects.toThrow('Sign-out could not be confirmed');expect(assign).not.toHaveBeenCalled();expect(m.session).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(Response.json({csrfToken:'unit-only-csrf'})).mockResolvedValueOnce(Response.json({url:'https://www.veggat.com/auth/login'}));
  await confirmedSignOut();expect(assign).toHaveBeenCalledWith('https://www.veggat.com/auth/login');
});
it.each(['https://attacker.example/auth/login','https://www.veggat.com/api/auth/error?error=MissingCSRF'])('rejects an unexpected redirect %s',async url=>{
  fetchMock.mockResolvedValueOnce(Response.json({url}));await expect(confirmedSignOut()).rejects.toThrow();expect(assign).not.toHaveBeenCalled();
});
it('does not submit without a real CSRF token',async()=>{
  fetchMock.mockReset().mockResolvedValueOnce(Response.json({}));await expect(confirmedSignOut()).rejects.toThrow();expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('preserves same-origin credentials and Auth.js CSRF protocol',async()=>{
  fetchMock.mockResolvedValueOnce(Response.json({url:'https://www.veggat.com/auth/login'}));await confirmedSignOut();
  expect(fetchMock.mock.calls[1][1]).toMatchObject({method:'POST',credentials:'same-origin',headers:{'X-Auth-Return-Redirect':'1'}});
  expect(fetchMock.mock.calls[1][1].body.get('csrfToken')).toBe('unit-only-csrf');expect(m.session).toHaveBeenCalledWith({broadcast:true});
});
it('does not contact the server for an external callback',async()=>{
  await expect(confirmedSignOut('https://attacker.example')).rejects.toThrow();expect(fetchMock).not.toHaveBeenCalled();
});
