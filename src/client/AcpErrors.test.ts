import { describe, it, expect } from 'vitest';
import {
  AcpTransportError,
  AcpProtocolError,
  AcpTimeoutError,
  AcpProcessExitError,
} from './AcpErrors';

describe('AcpErrors', () => {
  describe('AcpTransportError', () => {
    it('should have correct name and store the cause', () => {
      const cause = new Error('Network failure');
      const error = new AcpTransportError('Transport failed', cause);

      expect(error.name).toBe('AcpTransportError');
      expect(error.message).toBe('Transport failed');
      expect(error.cause).toBe(cause);
    });

    it('should have correct inheritance chain', () => {
      const error = new AcpTransportError('Transport failed');
      expect(error).toBeInstanceOf(AcpTransportError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AcpProtocolError', () => {
    it('should store method, code, and data', () => {
      const error = new AcpProtocolError('Protocol failed', 'myMethod', 123, { detail: 'info' });

      expect(error.name).toBe('AcpProtocolError');
      expect(error.message).toBe('Protocol failed');
      expect(error.method).toBe('myMethod');
      expect(error.code).toBe(123);
      expect(error.data).toEqual({ detail: 'info' });
    });

    it('should have correct inheritance chain', () => {
      const error = new AcpProtocolError('Protocol failed', 'myMethod');
      expect(error).toBeInstanceOf(AcpProtocolError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AcpTimeoutError', () => {
    it('should have correct message format', () => {
      const error = new AcpTimeoutError('slowMethod', 5000);

      expect(error.name).toBe('AcpTimeoutError');
      expect(error.message).toBe("ACP request 'slowMethod' timed out after 5000ms");
      expect(error.method).toBe('slowMethod');
      expect(error.timeoutMs).toBe(5000);
    });

    it('should have correct inheritance chain', () => {
      const error = new AcpTimeoutError('slowMethod', 5000);
      expect(error).toBeInstanceOf(AcpTimeoutError);
      expect(error).toBeInstanceOf(AcpTransportError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('AcpProcessExitError', () => {
    it('should store exitCode and signal with correct message', () => {
      const error = new AcpProcessExitError(1, 'SIGTERM');

      expect(error.name).toBe('AcpProcessExitError');
      expect(error.message).toBe('ACP process exited (code=1, signal=SIGTERM)');
      expect(error.exitCode).toBe(1);
      expect(error.signal).toBe('SIGTERM');
    });

    it('should have correct inheritance chain', () => {
      const error = new AcpProcessExitError(1, 'SIGTERM');
      expect(error).toBeInstanceOf(AcpProcessExitError);
      expect(error).toBeInstanceOf(AcpTransportError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
