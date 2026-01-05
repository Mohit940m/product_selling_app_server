declare module 'swagger-model-validator' {
    import { OpenAPIV3 } from 'openapi-types';

    interface ValidatorResult {
        errors: Array<{
            message: string;
            path: string;
        }>;
        warnings: Array<{
            message: string;
            path: string;
        }>;
    }

    export default function swaggerModelValidator(
        swaggerSpec: OpenAPIV3.Document
    ): {
        validateModel: (
            modelName: string,
            model: any,
            options?: { expectResponse: boolean }
        ) => ValidatorResult;
    };
}