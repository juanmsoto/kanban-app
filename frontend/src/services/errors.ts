type ErrorResponse = {
    error: string;
    fields?: Record<string, string[]>;
};

export class ApiError extends Error {
    status: number;
    fields: Record<string, string[]> | undefined;

    constructor(
        message: string,
        status: number,
        fields?: Record<string, string[]>,
    ) {
        super(message);
        this.status = status;
        this.fields = fields;
    }
}

export async function throwApiError(response: Response) {
    if (response.ok) {
        return;
    }

    let errorBody: ErrorResponse;

    try {
        errorBody = await response.json();
    } catch {
        throw new ApiError(
            `Error inesperado del servidor (${response.status}). Intentá de nuevo más tarde.`,
            response.status,
        );
    }

    throw new ApiError(errorBody.error, response.status, errorBody.fields);
}
