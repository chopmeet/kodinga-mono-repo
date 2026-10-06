import { Progress } from "./progress";


function StepIndicator({
    tabs, index
}: {
    tabs: string[];
    index: number;
}) {


    return (
        <div className="py-5 step__indicator">
            <div className="flex items-center justify-between">
                <p className="text-primary font-bold font-barlow">
                    Étape {index+1} sur {tabs.length}
                </p>
                <p>
                    {(index+1)/tabs.length * 100}% complété
                </p>
            </div>
            <Progress value={(index+1)/tabs.length * 100} />
        </div>
    )
}

export {
    StepIndicator
}