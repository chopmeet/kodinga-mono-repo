import { parseApiError } from './errors';

// Payloads captured from the Django api (apps/api)
describe('parseApiError', () => {
  it('translates known error codes', () => {
    const error = {
      status: 401,
      data: { success: false, code: 'invalid_credentials', message: 'Invalid email or password.', details: {} },
    };
    expect(parseApiError(error)).toEqual({
      code: 'invalid_credentials',
      message: 'Email ou mot de passe incorrect.',
      fields: {},
    });
  });

  it('maps serializer field errors', () => {
    const error = {
      status: 400,
      data: {
        success: false,
        code: 'invalid',
        message: 'Validation or processing error.',
        details: { email: ['Saisissez une adresse e-mail valide.'] },
      },
    };
    expect(parseApiError(error).fields).toEqual({ email: 'Saisissez une adresse e-mail valide.' });
  });

  it('shows every form-level error message', () => {
    const error = {
      status: 400,
      data: {
        success: false,
        code: 'invalid',
        message: 'Validation or processing error.',
        details: { non_field_errors: ['Ce mot de passe est trop courant.', 'Ce mot de passe est entièrement numérique.'] },
      },
    };
    expect(parseApiError(error).message).toBe(
      'Ce mot de passe est trop courant. Ce mot de passe est entièrement numérique.'
    );
  });

  it('handles network failures', () => {
    expect(parseApiError({ status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' }).message).toBe(
      'Impossible de joindre le serveur. Vérifiez votre connexion.'
    );
  });
});
