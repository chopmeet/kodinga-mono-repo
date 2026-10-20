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
export const unwrap = <T>(response: ApiSuccess<T> | T): T =>
  response && typeof response === 'object' && 'data' in response
    ? (response as ApiSuccess<T>).data
    : (response as T);

/** Paginated list (common/utils/pagination.py: StandardResultsSetPagination) */
export type ApiPaginated<T> = {
  success: true;
  pagination: {
    count: number;
    total_pages: number;
    current_page: number;
    next: string | null;
    previous: string | null;
    page_size: number;
  };
  results: T[];
};
