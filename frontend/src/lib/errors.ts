type ErrorResponse = {
    error: string;
    fields?: Record<string, string[]>;
};

export class ApiError extends Error {
    fields: Record<string, string[]> | undefined;

    constructor(message: string, fields?: Record<string, string[]>) {
        super(message);
        this.fields = fields;
    }
}

export async function throwApiError(response: Response) {
    if (!response.ok) {
        const errorBody: ErrorResponse = await response.json();
        throw new ApiError(errorBody.error, errorBody.fields);
    }
}
