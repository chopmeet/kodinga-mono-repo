// Envelopes returned by the Django api (common/utils/responses.py, common/exceptions/handler.py)

export type ApiSuccess<T> = {
  success: true;
  message?: string;
  data: T;
};

export type ApiErrorBody = {
  success: false;
  code: string;
  message: string;
  /** Field errors from DRF serializers: { email: ['...'], non_field_errors: ['...'] } */
  details?: Record<string, string[] | string>;
};

/** RTK Query `transformResponse` helper: keep only `data` */
export const unwrap = <T>(response: ApiSuccess<T>) => response.data;
