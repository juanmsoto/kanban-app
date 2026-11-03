export type ErrorResponse = {
    error: string;
    fields?: Record<string, string[]>;
};

export type User = {
    id: number;
    name: string;
    email: string;
};
